'use server'

import { createAuditLog } from '@/lib/audit'
import { canManageGroup, canManageUser } from '@/lib/auth/roles'
import { hashPassword } from 'better-auth/crypto'
import { prisma } from '@habidat/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { groupAdminAction, userAction } from './client'

// Schema definitions
const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  location: z.string().optional(),
  preferredLanguage: z.string().default('de'),
  storageQuota: z.string().default('1 GB'),
  memberGroupIds: z.array(z.string()),
  ownerGroupIds: z.array(z.string()).optional(),
})

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  location: z.string().optional().nullable(),
  preferredLanguage: z.string().optional(),
  storageQuota: z.string().optional(),
  memberGroupIds: z.array(z.string()).optional(),
  ownerGroupIds: z.array(z.string()).optional(),
})

const updateProfileSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional().nullable(),
  preferredLanguage: z.string(),
  primaryGroupId: z.string().optional().nullable(),
})

// Create user action (group admin or admin)
export const createUserAction = groupAdminAction
  .schema(createUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    // Verify actor can add to all specified groups
    for (const groupId of parsedInput.memberGroupIds) {
      if (!canManageGroup(session, groupId)) {
        throw new Error('You cannot add users to this group')
      }
    }

    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: parsedInput.username }, { email: parsedInput.email }],
      },
    })
    if (existing) {
      throw new Error('Username or email already exists')
    }

    // Generate LDAP UID number
    const maxUid = await prisma.user.aggregate({
      _max: { ldapUidNumber: true },
    })
    const ldapUidNumber = (maxUid._max.ldapUidNumber || 10000) + 1

    // Hash password
    const hashedPassword = await hashPassword(parsedInput.password)

    // Create user with groups
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          name: parsedInput.name,
          username: parsedInput.username,
          email: parsedInput.email,
          emailVerified: true,
          location: parsedInput.location,
          preferredLanguage: parsedInput.preferredLanguage,
          storageQuota: parsedInput.storageQuota,
          ldapUidNumber,
          primaryGroupId: parsedInput.memberGroupIds[0] || null,
        },
      })

      // Create password account
      await tx.account.create({
        data: {
          userId: newUser.id,
          accountId: newUser.id,
          providerId: 'credential',
          password: hashedPassword,
        },
      })

      // Create memberships
      if (parsedInput.memberGroupIds.length > 0) {
        await tx.groupMembership.createMany({
          data: parsedInput.memberGroupIds.map((groupId) => ({
            userId: newUser.id,
            groupId,
          })),
        })
      }

      // Create ownerships
      if (parsedInput.ownerGroupIds?.length) {
        await tx.groupOwnership.createMany({
          data: parsedInput.ownerGroupIds.map((groupId) => ({
            userId: newUser.id,
            groupId,
          })),
        })
      }

      return newUser
    })

    await createAuditLog({
      actorId: session.user.id,
      action: 'CREATE',
      entityType: 'USER',
      entityId: user.id,
      newValue: { name: user.name, username: user.username, email: user.email },
    })

    revalidatePath('/users')
    return { user }
  })

// Update user action (group admin or admin)
export const updateUserAction = groupAdminAction
  .schema(updateUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    const existingUser = await prisma.user.findUniqueOrThrow({
      where: { id: parsedInput.id },
      include: { memberships: true },
    })

    if (!canManageUser(session, existingUser.memberships)) {
      throw new Error('You do not have permission to update this user')
    }

    const user = await prisma.$transaction(async (tx) => {
      // Update user fields
      const updated = await tx.user.update({
        where: { id: parsedInput.id },
        data: {
          name: parsedInput.name,
          email: parsedInput.email,
          location: parsedInput.location,
          preferredLanguage: parsedInput.preferredLanguage,
          storageQuota: parsedInput.storageQuota,
        },
      })

      // Update memberships if provided
      if (parsedInput.memberGroupIds) {
        await tx.groupMembership.deleteMany({
          where: { userId: parsedInput.id },
        })
        if (parsedInput.memberGroupIds.length > 0) {
          await tx.groupMembership.createMany({
            data: parsedInput.memberGroupIds.map((groupId) => ({
              userId: parsedInput.id,
              groupId,
            })),
          })
        }
      }

      // Update ownerships if provided
      if (parsedInput.ownerGroupIds) {
        await tx.groupOwnership.deleteMany({
          where: { userId: parsedInput.id },
        })
        if (parsedInput.ownerGroupIds.length > 0) {
          await tx.groupOwnership.createMany({
            data: parsedInput.ownerGroupIds.map((groupId) => ({
              userId: parsedInput.id,
              groupId,
            })),
          })
        }
      }

      return updated
    })

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: user.id,
      oldValue: { name: existingUser.name, email: existingUser.email },
      newValue: { name: user.name, email: user.email },
    })

    revalidatePath('/users')
    revalidatePath(`/users/${user.id}`)
    return { user }
  })

// Update own profile
export const updateProfileAction = userAction
  .schema(updateProfileSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    const oldUser = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
    })

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: parsedInput.name,
        location: parsedInput.location,
        preferredLanguage: parsedInput.preferredLanguage,
        primaryGroupId: parsedInput.primaryGroupId,
      },
    })

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: user.id,
      oldValue: { name: oldUser.name, location: oldUser.location },
      newValue: { name: user.name, location: user.location },
    })

    revalidatePath('/')
    return { user }
  })

// Delete user action (group admin or admin)
export const deleteUserAction = groupAdminAction
  .schema(z.object({ userId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: parsedInput.userId },
      include: { memberships: true },
    })

    if (!canManageUser(session, user.memberships)) {
      throw new Error('You do not have permission to delete this user')
    }

    // Prevent deleting yourself
    if (user.id === session.user.id) {
      throw new Error('You cannot delete your own account')
    }

    await prisma.user.delete({ where: { id: user.id } })

    await createAuditLog({
      actorId: session.user.id,
      action: 'DELETE',
      entityType: 'USER',
      entityId: user.id,
      oldValue: { name: user.name, username: user.username, email: user.email },
    })

    revalidatePath('/users')
    return { success: true }
  })

// Get users (for list page)
export async function getUsers(search?: string) {
  return prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: {
      memberships: {
        include: {
          group: { select: { id: true, name: true, slug: true } },
        },
      },
      ownerships: {
        include: {
          group: { select: { id: true, name: true, slug: true } },
        },
      },
      primaryGroup: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { name: 'asc' },
  })
}

// Get single user
export async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          group: { select: { id: true, name: true, slug: true } },
        },
      },
      ownerships: {
        include: {
          group: { select: { id: true, name: true, slug: true } },
        },
      },
      primaryGroup: { select: { id: true, name: true, slug: true } },
    },
  })
}
