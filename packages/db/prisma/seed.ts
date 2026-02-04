/**
 * Prisma seed: creates admin group and admin user (DB + optional LDAP).
 *
 * Required env: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 * Optional env: ADMIN_NAME (default: "Admin"), ADMIN_USERNAME (default: "admin"),
 *               ADMIN_GROUP_SLUG (default: "admin"), ADMIN_GROUP_NAME (default: "Admin")
 * Optional LDAP bootstrap (if all set): LDAP_URL, LDAP_BIND_DN, LDAP_BIND_PASSWORD,
 *               LDAP_BASE_DN, LDAP_USERS_DN, LDAP_GROUPS_DN
 *
 * Uses better-auth's scrypt hash for DB; SSHA for LDAP userPassword.
 */
import { LdapService, hashPasswordSsha } from '@habidat/ldap'
import { hashPassword } from 'better-auth/crypto'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/client'

// Load root .env so ADMIN_* and DATABASE_URL are available when running from monorepo root
config({ path: resolve(process.cwd(), '../../.env') })
config() // Load local .env to override

function getLdapEnv() {
  const url = process.env.LDAP_URL
  const bindDn = process.env.LDAP_BIND_DN
  const bindPassword = process.env.LDAP_BIND_PASSWORD
  const baseDn = process.env.LDAP_BASE_DN
  const usersDn = process.env.LDAP_USERS_DN
  const groupsDn = process.env.LDAP_GROUPS_DN
  if (url && bindDn && bindPassword && baseDn && usersDn && groupsDn) {
    return { url, bindDn, bindPassword, baseDn, usersDn, groupsDn }
  }
  return null
}

async function bootstrapLdap(
  ldap: LdapService,
  prisma: PrismaClient,
  adminUser: { id: string; username: string; name: string; email: string; ldapUidNumber: number },
  adminGroup: { id: string; slug: string; name: string },
  adminPasswordSsha: string
) {
  const usersDn = ldap.getUsersDn()
  const groupsDn = ldap.getGroupsDn()

  await ldap.ensureOrganizationalUnit(usersDn)
  console.log(`LDAP: ensured OU ${usersDn}`)
  await ldap.ensureOrganizationalUnit(groupsDn)
  console.log(`LDAP: ensured OU ${groupsDn}`)

  let adminGroupLdapDn: string | null = null
  const existingGroup = await ldap.findGroupBySlug(adminGroup.slug)
  if (!existingGroup) {
    adminGroupLdapDn = await ldap.createGroup({
      slug: adminGroup.slug,
      name: adminGroup.name,
      description: 'System administrator group',
      memberDns: [], // will add admin user after
    })
    console.log(`LDAP: created admin group ${adminGroup.slug}`)
  } else {
    adminGroupLdapDn = existingGroup.dn
    console.log(`LDAP: admin group already exists: ${adminGroup.slug}`)
  }

  const existingUser = await ldap.findUserByUsername(adminUser.username)
  if (!existingUser) {
    let userDn: string
    try {
      userDn = await ldap.createUser({
        username: adminUser.username,
        name: adminUser.name,
        email: adminUser.email,
        ldapUidNumber: adminUser.ldapUidNumber,
        userPassword: adminPasswordSsha,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`LDAP createUser failed for ${adminUser.username}: ${msg}`, { cause: err })
    }
    console.log(`LDAP: created admin user ${adminUser.username}`)

    await prisma.user.update({
      where: { id: adminUser.id },
      data: { ldapDn: userDn, ldapSynced: true, ldapSyncedAt: new Date() },
    })

    if (adminGroupLdapDn) {
      await ldap.updateGroup(adminGroupLdapDn, {
        memberDns: [userDn],
      })
      await prisma.group.update({
        where: { id: adminGroup.id },
        data: { ldapDn: adminGroupLdapDn, ldapSynced: true, ldapSyncedAt: new Date() },
      })
    }
  } else {
    console.log(`LDAP: admin user already exists: ${adminUser.username}`)
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { ldapDn: existingUser.dn, ldapSynced: true, ldapSyncedAt: new Date() },
    })
    if (adminGroupLdapDn) {
      await ldap.updateGroup(adminGroupLdapDn, { memberDns: [existingUser.dn] })
      await prisma.group.update({
        where: { id: adminGroup.id },
        data: { ldapDn: adminGroupLdapDn, ldapSynced: true, ldapSyncedAt: new Date() },
      })
    }
  }
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME ?? 'Admin'
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin'

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment to seed the admin user.'
    )
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the seed.')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const adminGroupSlug = process.env.ADMIN_GROUP_SLUG ?? 'admin'
    const adminGroupName = process.env.ADMIN_GROUP_NAME ?? 'Admin'

    let adminGroup = await prisma.group.findUnique({
      where: { slug: adminGroupSlug },
    })

    if (!adminGroup) {
      adminGroup = await prisma.group.create({
        data: {
          slug: adminGroupSlug,
          name: adminGroupName,
          description: 'System administrator group',
          isSystem: true,
        },
      })
      console.log(`Created admin group: ${adminGroup.name} (${adminGroup.slug})`)
    } else {
      console.log(`Admin group already exists: ${adminGroup.name} (${adminGroup.slug})`)
    }

    let adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (!adminUser) {
      const maxUid = await prisma.user.aggregate({
        _max: { ldapUidNumber: true },
      })
      const ldapUidNumber = (maxUid._max.ldapUidNumber ?? 10000) + 1
      const hashedPassword = await hashPassword(adminPassword)

      adminUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: adminName,
            username: adminUsername,
            email: adminEmail,
            emailVerified: true,
            ldapUidNumber,
            primaryGroupId: adminGroup!.id,
          },
        })

        await tx.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: 'credential',
            password: hashedPassword,
          },
        })

        await tx.groupMembership.create({
          data: {
            userId: user.id,
            groupId: adminGroup!.id,
          },
        })

        await tx.groupOwnership.create({
          data: {
            userId: user.id,
            groupId: adminGroup!.id,
          },
        })

        return user
      })

      console.log(`Created admin user: ${adminUser.name} (${adminUser.email})`)
    } else {
      console.log(`Admin user already exists: ${adminUser.name} (${adminUser.email})`)

      const [membership, ownership] = await Promise.all([
        prisma.groupMembership.findUnique({
          where: {
            userId_groupId: { userId: adminUser.id, groupId: adminGroup.id },
          },
        }),
        prisma.groupOwnership.findUnique({
          where: {
            userId_groupId: { userId: adminUser.id, groupId: adminGroup.id },
          },
        }),
      ])

      if (!membership) {
        await prisma.groupMembership.create({
          data: { userId: adminUser.id, groupId: adminGroup.id },
        })
        console.log('Added admin user to admin group as member')
      }
      if (!ownership) {
        await prisma.groupOwnership.create({
          data: { userId: adminUser.id, groupId: adminGroup.id },
        })
        console.log('Added admin user to admin group as owner')
      }
    }

    const ldapEnv = getLdapEnv()
    if (ldapEnv) {
      let adminUserForLdap = adminUser
      if (adminUser.ldapUidNumber == null) {
        const maxUid = await prisma.user.aggregate({
          _max: { ldapUidNumber: true },
        })
        const ldapUidNumber = (maxUid._max.ldapUidNumber ?? 10000) + 1
        adminUserForLdap = await prisma.user.update({
          where: { id: adminUser.id },
          data: { ldapUidNumber },
        })
      }
      const ldap = new LdapService(ldapEnv)
      await ldap.connect()
      try {
        const adminPasswordSsha = hashPasswordSsha(adminPassword)
        await bootstrapLdap(ldap, prisma, {
          id: adminUserForLdap.id,
          username: adminUserForLdap.username,
          name: adminUserForLdap.name,
          email: adminUserForLdap.email,
          ldapUidNumber: adminUserForLdap.ldapUidNumber ?? 10000,
        }, adminGroup, adminPasswordSsha)
      } finally {
        await ldap.disconnect()
      }
    } else {
      console.log('LDAP env not set (LDAP_URL, LDAP_BIND_DN, etc.) – skipping LDAP bootstrap.')
    }
  } finally {
    await pool.end()
  }
}

main()
  .then(() => {
    console.log('Seed completed successfully.')
    process.exit(0)
  })
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
