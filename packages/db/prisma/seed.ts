import { resolve } from 'node:path'
/**
 * Prisma seed: creates admin group and admin user (DB + optional LDAP), or imports from LDAP.
 *
 * Required env: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 * Optional env: ADMIN_NAME (default: "Admin"), ADMIN_USERNAME (default: "admin"),
 *               ADMIN_GROUP_SLUG (default: "admin"), ADMIN_GROUP_NAME (default: "Admin")
 * Optional LDAP (if all set): LDAP_URL, LDAP_BIND_DN, LDAP_BIND_PASSWORD,
 *               LDAP_BASE_DN, LDAP_USERS_DN, LDAP_GROUPS_DN
 *
 * Behaviour:
 * - If LDAP env is set and LDAP has users/groups: import from LDAP into DB (member = users + subgroups, owner = group admins).
 * - If LDAP is empty or not set: create admin user/group in DB, then optionally bootstrap LDAP.
 * Imported users keep LDAP hashed passwords (SSHA); passwordHashType is set so they can still log in.
 */
import { hashPasswordSsha, LdapService } from '@habidat/ldap'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from 'better-auth/crypto'
import { config } from 'dotenv'
import { Pool } from 'pg'
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

/** True if dn is under baseDn (e.g. uid=john,ou=users,dc=... under ou=users,dc=...). Case-insensitive. */
function dnUnder(dn: string, baseDn: string): boolean {
  const d = dn.toLowerCase().trim()
  const b = baseDn.toLowerCase().trim()
  return d === b || d.endsWith(`,${b}`)
}

/** Normalize DN for consistent map keys and lookups (LDAP DNs are case-insensitive). */
function normalizeDn(dn: string): string {
  return dn.trim().toLowerCase()
}

/** PostgreSQL integer is 32-bit signed. LDAP uidNumber can be larger; only store if in range. */
const PG_INT_MIN = -2_147_483_648
const PG_INT_MAX = 2_147_483_647
function fitsInPgInt(n: number): boolean {
  return Number.isInteger(n) && n >= PG_INT_MIN && n <= PG_INT_MAX
}

/**
 * Import users and groups from LDAP into the database.
 * - Group member = user members + subgroups (member DNs under usersDn → GroupMembership; under groupsDn → GroupHierarchy child).
 * - Group owner = group admins (owner DNs under usersDn → GroupOwnership).
 * Returns true if import was performed (LDAP had data), false if LDAP was empty.
 */
async function importFromLdap(
  ldap: LdapService,
  prisma: PrismaClient,
  usersDn: string,
  groupsDn: string
): Promise<boolean> {
  const ldapUsers = await ldap.listAllUsers()
  const ldapGroups = await ldap.listAllGroups()
  if (ldapUsers.length === 0 && ldapGroups.length === 0) return false

  console.log(`LDAP import: ${ldapUsers.length} users, ${ldapGroups.length} groups`)

  const userDnToId = new Map<string, string>()
  const groupDnToId = new Map<string, string>()

  await prisma.$transaction(
    async (tx) => {
      for (const u of ldapUsers) {
        const email = (u.mail ?? '').trim() || `${u.uid}@ldap-import.local`
        const name = (u.cn ?? u.uid ?? 'Unknown').trim()
        const username = u.uid.trim()
        const uidNum = u.uidNumber ? Number.parseInt(u.uidNumber, 10) : undefined
        const ldapUidNumber = uidNum !== undefined && fitsInPgInt(uidNum) ? uidNum : undefined

        const existing = await tx.user.findFirst({
          where: { OR: [{ username }, { email }, { ldapDn: u.dn }] },
        })
        if (existing) {
          userDnToId.set(normalizeDn(u.dn), existing.id)
          if (!existing.ldapDn) {
            await tx.user.update({
              where: { id: existing.id },
              data: {
                ldapDn: u.dn,
                ldapUidNumber:
                  ldapUidNumber !== undefined
                    ? ldapUidNumber
                    : (existing.ldapUidNumber ?? undefined),
              },
            })
          }
          continue
        }

        const user = await tx.user.create({
          data: {
            name,
            username,
            email,
            emailVerified: true,
            ldapDn: u.dn,
            ldapUidNumber: ldapUidNumber ?? undefined,
            ldapSynced: true,
            ldapSyncedAt: new Date(),
            location: u.l ?? null,
            preferredLanguage: u.preferredLanguage ?? 'de',
            storageQuota: u.description ?? '1 GB',
          },
        })
        userDnToId.set(normalizeDn(u.dn), user.id)

        const storedPassword = (u.userPassword ?? '').trim()
        if (storedPassword) {
          let password: string
          let passwordHashType: string
          if (storedPassword.startsWith('{SSHA}')) {
            password = storedPassword
            passwordHashType = 'ssha'
          } else if (storedPassword.startsWith('$scrypt$') || storedPassword.startsWith('$2')) {
            password = storedPassword
            passwordHashType = 'scrypt'
          } else {
            password = await hashPassword(storedPassword)
            passwordHashType = 'scrypt'
          }
          await tx.account.create({
            data: {
              userId: user.id,
              accountId: user.id,
              providerId: 'credential',
              password,
              passwordHashType,
            },
          })
        }
      }

      for (const g of ldapGroups) {
        const slug = g.cn.trim()
        const name = (g.o ?? g.cn ?? slug).trim()
        const description = (g.description ?? '').trim()

        const existing = await tx.group.findFirst({
          where: { OR: [{ slug }, { ldapDn: g.dn }] },
        })
        if (existing) {
          groupDnToId.set(normalizeDn(g.dn), existing.id)
          if (!existing.ldapDn) {
            await tx.group.update({
              where: { id: existing.id },
              data: { ldapDn: g.dn, ldapSynced: true, ldapSyncedAt: new Date() },
            })
          }
          continue
        }

        const group = await tx.group.create({
          data: {
            slug,
            name,
            description: description || ' ',
            ldapDn: g.dn,
            ldapSynced: true,
            ldapSyncedAt: new Date(),
            isSystem: slug === 'admin' || slug === 'groupadmin',
          },
        })
        groupDnToId.set(normalizeDn(g.dn), group.id)
      }

      for (const g of ldapGroups) {
        const groupId = groupDnToId.get(normalizeDn(g.dn))
        if (!groupId) continue

        const members = g.member ?? []
        for (const memberDn of members) {
          const dnNorm = memberDn.trim()
          if (dnUnder(dnNorm, usersDn)) {
            const userId = userDnToId.get(normalizeDn(dnNorm))
            if (userId) {
              const userExists = await tx.user.findUnique({
                where: { id: userId },
                select: { id: true },
              })
              if (userExists) {
                await tx.groupMembership.upsert({
                  where: {
                    userId_groupId: { userId, groupId },
                  },
                  create: { userId, groupId },
                  update: {},
                })
              }
            }
          } else if (dnUnder(dnNorm, groupsDn)) {
            const childGroupId = groupDnToId.get(normalizeDn(dnNorm))
            if (childGroupId && childGroupId !== groupId) {
              await tx.groupHierarchy.upsert({
                where: {
                  parentGroupId_childGroupId: { parentGroupId: groupId, childGroupId },
                },
                create: { parentGroupId: groupId, childGroupId },
                update: {},
              })
            }
          }
        }

        const owners = g.owner ?? []
        for (const ownerDn of owners) {
          const dnNorm = ownerDn.trim()
          if (dnUnder(dnNorm, usersDn)) {
            const userId = userDnToId.get(normalizeDn(dnNorm))
            if (userId) {
              const userExists = await tx.user.findUnique({
                where: { id: userId },
                select: { id: true },
              })
              if (userExists) {
                await tx.groupOwnership.upsert({
                  where: {
                    userId_groupId: { userId, groupId },
                  },
                  create: { userId, groupId },
                  update: {},
                })
              }
            }
          }
        }
      }

      // Ensure groupadmin system group exists and sync membership (all users with any GroupOwnership)
      let groupAdminGroup = await tx.group.findUnique({
        where: { slug: 'groupadmin' },
      })
      if (!groupAdminGroup) {
        groupAdminGroup = await tx.group.create({
          data: {
            slug: 'groupadmin',
            name: 'Group Admins',
            description:
              'System group: all users who are admin of any group (managed automatically)',
            isSystem: true,
          },
        })
      }
      const ownerUserIds = await tx.groupOwnership.findMany({
        select: { userId: true },
        distinct: ['userId'],
      })
      for (const { userId: uid } of ownerUserIds) {
        await tx.groupMembership.upsert({
          where: {
            userId_groupId: { userId: uid, groupId: groupAdminGroup.id },
          },
          create: { userId: uid, groupId: groupAdminGroup.id },
          update: {},
        })
      }

      for (const u of ldapUsers) {
        const userId = userDnToId.get(normalizeDn(u.dn))
        if (!userId) continue
        const memberships = await tx.groupMembership.findMany({
          where: { userId },
          select: { groupId: true },
        })
        const memberGroupIds = memberships.map((m) => m.groupId)
        if (memberGroupIds.length === 0) continue
        let primaryGroupId: string | null = null
        if (u.ou?.trim()) {
          const groupByOu = await tx.group.findFirst({
            where: { ldapDn: u.ou.trim() },
            select: { id: true },
          })
          if (groupByOu && memberGroupIds.includes(groupByOu.id)) {
            primaryGroupId = groupByOu.id
          }
        }
        if (!primaryGroupId) primaryGroupId = memberGroupIds[0]
        await tx.user.update({
          where: { id: userId },
          data: { primaryGroupId },
        })
      }
    },
    { timeout: 300_000 }
  )

  console.log('LDAP import completed.')
  return true
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

  const userCount = await prisma.user.count()
  if (userCount > 0) {
    console.log('User count is greater than 0 – skipping seed.')
    return
  }

  try {
    const ldapEnv = getLdapEnv()
    if (ldapEnv) {
      const ldap = new LdapService(ldapEnv)
      await ldap.connect()
      try {
        const didImport = await importFromLdap(ldap, prisma, ldapEnv.usersDn, ldapEnv.groupsDn)
        if (didImport) {
          console.log('LDAP import completed. Skipping admin creation.')
          // Try importing JSON data first or alongside
          await importJsonData(prisma)
          return
        }
      } finally {
        await ldap.disconnect()
      }
      console.log('LDAP empty – creating admin user/group in DB and bootstrapping LDAP.')
    } else {
      console.log('LDAP env not set – creating admin user/group in DB only.')
    }

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

    // System group "groupadmin": holds all users who have admin rights to any group (managed automatically)
    let groupAdminGroup = await prisma.group.findUnique({
      where: { slug: 'groupadmin' },
    })
    if (!groupAdminGroup) {
      groupAdminGroup = await prisma.group.create({
        data: {
          slug: 'groupadmin',
          name: 'Group Admins',
          description: 'System group: all users who are admin of any group (managed automatically)',
          isSystem: true,
        },
      })
      console.log(
        `Created groupadmin system group: ${groupAdminGroup.name} (${groupAdminGroup.slug})`
      )
    } else {
      console.log(
        `Groupadmin system group already exists: ${groupAdminGroup.name} (${groupAdminGroup.slug})`
      )
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
            passwordHashType: 'scrypt',
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

        // Admin user is an owner of admin group → add to groupadmin system group
        await tx.groupMembership.upsert({
          where: {
            userId_groupId: { userId: user.id, groupId: groupAdminGroup!.id },
          },
          create: { userId: user.id, groupId: groupAdminGroup!.id },
          update: {},
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
      // Ensure admin user is in groupadmin (they are an owner of admin group)
      if (groupAdminGroup) {
        await prisma.groupMembership.upsert({
          where: {
            userId_groupId: { userId: adminUser.id, groupId: groupAdminGroup.id },
          },
          create: { userId: adminUser.id, groupId: groupAdminGroup.id },
          update: {},
        })
      }
    }

    // Ensure default email templates exist (invite, passwordReset)
    const defaultInviteConfig = {
      greeting: 'Hello,',
      mainText:
        'You have been invited to join. Click the button below to accept the invitation and create your account.',
      ctaText: 'Accept invitation',
      footer: 'If you did not expect this invitation, you can ignore this email.',
    }
    const defaultPasswordResetConfig = {
      greeting: 'Hello,',
      mainText:
        'We received a request to reset your password. Click the button below to set a new password.',
      ctaText: 'Reset password',
      footer: 'If you did not request a password reset, you can ignore this email.',
    }
    await prisma.emailTemplate.upsert({
      where: { key: 'invite' },
      create: {
        key: 'invite',
        subject: 'You are invited',
        config: defaultInviteConfig,
        enabled: true,
      },
      update: {},
    })
    await prisma.emailTemplate.upsert({
      where: { key: 'passwordReset' },
      create: {
        key: 'passwordReset',
        subject: 'Reset your password',
        config: defaultPasswordResetConfig,
        enabled: true,
      },
      update: {},
    })
    console.log('Email templates (invite, passwordReset) ensured.')

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
        await bootstrapLdap(
          ldap,
          prisma,
          {
            id: adminUserForLdap.id,
            username: adminUserForLdap.username,
            name: adminUserForLdap.name,
            email: adminUserForLdap.email,
            ldapUidNumber: adminUserForLdap.ldapUidNumber ?? 10000,
          },
          adminGroup,
          adminPasswordSsha
        )
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

import { existsSync, readFileSync } from 'node:fs'

// ... existing code ...

async function importJsonData(prisma: PrismaClient) {
  const importDir = '/app/import'
  console.log(`Checking for import data in ${importDir}...`)

  if (!existsSync(importDir)) {
    console.log(`Import directory ${importDir} does not exist. Skipping JSON import.`)
    return
  }

  // 1. Import Settings
  const settingsPath = resolve(importDir, 'settingsStore.json')
  if (existsSync(settingsPath)) {
    try {
      const settingsData = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      const platformName = settingsData.title
      const themeColor = settingsData.theme?.primary

      if (platformName || themeColor) {
        const current = await prisma.setting.findUnique({ where: { key: 'general' } })
        let value = (current?.value as object) || {}
        if (platformName) value = { ...value, platformName }
        if (themeColor) value = { ...value, themeColor }

        await prisma.setting.upsert({
          where: { key: 'general' },
          create: { key: 'general', value },
          update: { value },
        })
        console.log('Imported general settings from settingsStore.json')
      }
    } catch (e) {
      console.error('Failed to import settingsStore.json:', e)
    }
  }

  // 2. Import Apps
  const appsPath = resolve(importDir, 'appStore.json')
  if (existsSync(appsPath)) {
    try {
      const appsData = JSON.parse(readFileSync(appsPath, 'utf-8'))
      if (Array.isArray(appsData)) {
        for (const app of appsData) {
          const slug = app.id
          // Skip if exists
          const exists = await prisma.app.findUnique({ where: { slug } })
          if (exists) {
            console.log(`App ${slug} already exists, skipping import.`)
            continue
          }

          await prisma.app.create({
            data: {
              slug,
              name: app.label,
              url: app.url,
              samlEnabled: app.saml?.samlEnabled || false,
              samlEntityId: app.saml?.entityId,
              samlAcsUrl: app.saml?.acs,
              samlSloUrl: app.saml?.slo,
            },
          })
          console.log(`Imported app: ${slug}`)
        }
      }
    } catch (e) {
      console.error('Failed to import appStore.json:', e)
    }
  }

  // 3. Import Invites
  const invitesPath = resolve(importDir, 'activationStore.json')
  if (existsSync(invitesPath)) {
    try {
      const invitesData = JSON.parse(readFileSync(invitesPath, 'utf-8'))
      let inviteCount = 0
      for (const token in invitesData) {
        const record = invitesData[token]
        if (record.type === 'invite' && record.data) {
          const { mail, member = [], owner = [] } = record.data
          const senderUsername = record.currentUser?.uid

          if (!mail) continue

          // Resolve sender
          let createdById: string | undefined
          if (senderUsername) {
            const sender = await prisma.user.findUnique({ where: { username: senderUsername } })
            createdById = sender?.id
          }

          if (!createdById) {
            // If sender not found, skip invite (or assign to admin? User didn't specify. Skipping is safer for now)
            console.log(`Sender ${senderUsername} not found for invite ${token}, skipping.`)
            continue
          }

          // Resolve Groups (split member/owner)
          const memberDns = (member || []) as string[]
          const ownerDns = (owner || []) as string[]

          const memberGroups = await prisma.group.findMany({
            where: { ldapDn: { in: memberDns } },
            select: { id: true },
          })
          const ownerGroups = await prisma.group.findMany({
            where: { ldapDn: { in: ownerDns } },
            select: { id: true },
          })

          // Create Invite
          const existing = await prisma.invite.findUnique({ where: { token } })
          if (!existing) {
            await prisma.invite.create({
              data: {
                token,
                email: mail,
                createdById,
                memberGroups: {
                  create: memberGroups.map((g) => ({ groupId: g.id })),
                },
                ownerGroups: {
                  create: ownerGroups.map((g) => ({ groupId: g.id })),
                },
                createdAt: new Date(record.created),
                expiresAt: new Date(record.expires),
              },
            })
            inviteCount++
          }
        }
      }
      console.log(`Imported ${inviteCount} invites from activationStore.json`)
    } catch (e) {
      console.error('Failed to import activationStore.json:', e)
    }
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
