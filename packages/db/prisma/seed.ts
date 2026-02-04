/**
 * Prisma seed: creates admin group and admin user from env.
 *
 * Required env: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 * Optional env: ADMIN_NAME (default: "Admin"), ADMIN_USERNAME (default: "admin"),
 *               ADMIN_GROUP_SLUG (default: "admin"), ADMIN_GROUP_NAME (default: "Admin")
 *
 * Uses better-auth's scrypt hash so seeded passwords work at login.
 */
import { hashPassword } from 'better-auth/crypto'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/client'

// Load root .env so ADMIN_* and DATABASE_URL are available when running from monorepo root
config({ path: resolve(process.cwd(), '../../.env') })
config() // Load local .env to override

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
    // Create admin group if it doesn't exist
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

    // Create admin user if it doesn't exist
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

      // Ensure admin user is member and owner of admin group
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
