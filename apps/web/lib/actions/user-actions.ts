'use server'

import { createAuditLog } from '@/lib/audit'
import { canManageGroup, canManageUser } from '@/lib/auth/roles'
import { hashPasswordSsha } from '@/lib/ldap/password'
import {
  createSyncEvent,
  dispatchDiscourseSyncAfterCommit,
  dispatchLdapSyncAfterCommit,
} from '@/lib/sync/create-sync-event'
import { prisma } from '@habidat/db'
import { hashPassword } from 'better-auth/crypto'
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

    // Hash password (bcrypt for better-auth, SSHA for LDAP sync)
    const hashedPassword = await hashPassword(parsedInput.password)
    const ldapPasswordSsha = hashPasswordSsha(parsedInput.password)

    // Create user with groups and LDAP + Discourse sync events (user + each group for member sync)
    const { user, ldapSyncEventId, groupSyncEventIds, discourseSyncEventId, discourseGroupSyncEventIds } =
      await prisma.$transaction(async (tx) => {
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
            primaryGroupId: parsedInput.memberGroupIds[0] ?? parsedInput.ownerGroupIds?.[0] ?? null,
          },
        })

        await tx.account.create({
          data: {
            userId: newUser.id,
            accountId: newUser.id,
            providerId: 'credential',
            password: hashedPassword,
            passwordHashType: 'scrypt',
          },
        })

        const effectiveMemberGroupIds = [
          ...new Set([...parsedInput.memberGroupIds, ...(parsedInput.ownerGroupIds ?? [])]),
        ]
        if (effectiveMemberGroupIds.length > 0) {
          await tx.groupMembership.createMany({
            data: effectiveMemberGroupIds.map((groupId) => ({
              userId: newUser.id,
              groupId,
            })),
          })
        }

        if (parsedInput.ownerGroupIds?.length) {
          await tx.groupOwnership.createMany({
            data: parsedInput.ownerGroupIds.map((groupId) => ({
              userId: newUser.id,
              groupId,
            })),
          })
        }

        const syncEvent = await createSyncEvent(tx, {
          target: 'LDAP',
          operation: 'CREATE',
          entityType: 'USER',
          entityId: newUser.id,
          payload: { userId: newUser.id, hashedPassword: ldapPasswordSsha },
        })
        const groupSyncEventIds: string[] = []
        for (const groupId of effectiveMemberGroupIds) {
          const ev = await createSyncEvent(tx, {
            target: 'LDAP',
            operation: 'UPDATE',
            entityType: 'GROUP',
            entityId: groupId,
            payload: { groupId },
          })
          groupSyncEventIds.push(ev.id)
        }
        const discourseUserEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'CREATE',
          entityType: 'USER',
          entityId: newUser.id,
          payload: { userId: newUser.id },
        })
        const discourseGroupSyncEventIds: string[] = []
        for (const groupId of effectiveMemberGroupIds) {
          const ev = await createSyncEvent(tx, {
            target: 'DISCOURSE',
            operation: 'UPDATE',
            entityType: 'GROUP',
            entityId: groupId,
            payload: { groupId },
          })
          discourseGroupSyncEventIds.push(ev.id)
        }
        return {
          user: newUser,
          ldapSyncEventId: syncEvent.id,
          groupSyncEventIds,
          discourseSyncEventId: discourseUserEv.id,
          discourseGroupSyncEventIds,
        }
      })

    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    for (const id of groupSyncEventIds) {
      await dispatchLdapSyncAfterCommit(id, 'LDAP')
    }
    await dispatchDiscourseSyncAfterCommit(discourseSyncEventId, 'DISCOURSE')
    for (const id of discourseGroupSyncEventIds) {
      await dispatchDiscourseSyncAfterCommit(id, 'DISCOURSE')
    }

    const newValue = {
      name: user.name,
      username: user.username,
      email: user.email,
      location: user.location ?? undefined,
      preferredLanguage: user.preferredLanguage,
      storageQuota: user.storageQuota,
      memberGroupIds: [...parsedInput.memberGroupIds],
      ownerGroupIds: [...(parsedInput.ownerGroupIds ?? [])],
    }
    await createAuditLog({
      actorId: session.user.id,
      action: 'CREATE',
      entityType: 'USER',
      entityId: user.id,
      newValue,
      entityName: user.name,
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
      include: { memberships: true, ownerships: true },
    })

    if (!canManageUser(session, existingUser.memberships)) {
      throw new Error('You do not have permission to update this user')
    }

    const beforeGroupIds = [
      ...new Set([
        ...existingUser.memberships.map((m) => m.groupId),
        ...existingUser.ownerships.map((o) => o.groupId),
      ]),
    ]

    const {
      user,
      ldapSyncEventId,
      groupSyncEventIds,
      discourseSyncEventId,
      discourseGroupSyncEventIds,
    } = await prisma.$transaction(async (tx) => {
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

      let afterGroupIds: string[] | null = null
      if (parsedInput.memberGroupIds) {
        afterGroupIds = [
          ...new Set([...parsedInput.memberGroupIds, ...(parsedInput.ownerGroupIds ?? [])]),
        ]
        await tx.groupMembership.deleteMany({
          where: { userId: parsedInput.id },
        })
        if (afterGroupIds.length > 0) {
          await tx.groupMembership.createMany({
            data: afterGroupIds.map((groupId) => ({
              userId: parsedInput.id,
              groupId,
            })),
          })
        }
      }

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
        if (!afterGroupIds) {
          afterGroupIds = [
            ...new Set([
              ...existingUser.memberships.map((m) => m.groupId),
              ...parsedInput.ownerGroupIds,
            ]),
          ]
        }
      }

      const syncEvent = await createSyncEvent(tx, {
        target: 'LDAP',
        operation: 'UPDATE',
        entityType: 'USER',
        entityId: updated.id,
        payload: { userId: updated.id },
      })
      const groupSyncEventIds: string[] = []
      const discourseGroupSyncEventIds: string[] = []
      if (afterGroupIds) {
        const affectedGroupIds = [...new Set([...beforeGroupIds, ...afterGroupIds])]
        for (const groupId of affectedGroupIds) {
          const ev = await createSyncEvent(tx, {
            target: 'LDAP',
            operation: 'UPDATE',
            entityType: 'GROUP',
            entityId: groupId,
            payload: { groupId },
          })
          groupSyncEventIds.push(ev.id)
          const discourseEv = await createSyncEvent(tx, {
            target: 'DISCOURSE',
            operation: 'UPDATE',
            entityType: 'GROUP',
            entityId: groupId,
            payload: { groupId },
          })
          discourseGroupSyncEventIds.push(discourseEv.id)
        }
      }
      const discourseUserEv = await createSyncEvent(tx, {
        target: 'DISCOURSE',
        operation: 'UPDATE',
        entityType: 'USER',
        entityId: updated.id,
        payload: { userId: updated.id },
      })
      return {
        user: updated,
        ldapSyncEventId: syncEvent.id,
        groupSyncEventIds,
        discourseSyncEventId: discourseUserEv.id,
        discourseGroupSyncEventIds,
      }
    })

    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    for (const id of groupSyncEventIds) {
      await dispatchLdapSyncAfterCommit(id, 'LDAP')
    }
    await dispatchDiscourseSyncAfterCommit(discourseSyncEventId, 'DISCOURSE')
    for (const id of discourseGroupSyncEventIds) {
      await dispatchDiscourseSyncAfterCommit(id, 'DISCOURSE')
    }

    const updatedWithRels = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { memberships: true, ownerships: true },
    })
    const oldValue = {
      name: existingUser.name,
      email: existingUser.email,
      location: existingUser.location ?? undefined,
      preferredLanguage: existingUser.preferredLanguage,
      storageQuota: existingUser.storageQuota,
      memberGroupIds: existingUser.memberships.map((m) => m.groupId),
      ownerGroupIds: existingUser.ownerships.map((o) => o.groupId),
    }
    const newValue = {
      name: updatedWithRels.name,
      email: updatedWithRels.email,
      location: updatedWithRels.location ?? undefined,
      preferredLanguage: updatedWithRels.preferredLanguage,
      storageQuota: updatedWithRels.storageQuota,
      memberGroupIds: updatedWithRels.memberships.map((m) => m.groupId),
      ownerGroupIds: updatedWithRels.ownerships.map((o) => o.groupId),
    }
    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: user.id,
      oldValue,
      newValue,
      entityName: user.name,
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

    const oldValue = {
      name: oldUser.name,
      location: oldUser.location ?? undefined,
      preferredLanguage: oldUser.preferredLanguage,
      primaryGroupId: oldUser.primaryGroupId ?? undefined,
    }
    const newValue = {
      name: user.name,
      location: user.location ?? undefined,
      preferredLanguage: user.preferredLanguage,
      primaryGroupId: user.primaryGroupId ?? undefined,
    }
    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: user.id,
      oldValue,
      newValue,
      entityName: user.name,
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
      include: { memberships: true, ownerships: true },
    })

    if (!canManageUser(session, user.memberships)) {
      throw new Error('You do not have permission to delete this user')
    }

    // Prevent deleting yourself
    if (user.id === session.user.id) {
      throw new Error('You cannot delete your own account')
    }

    const oldValue = {
      name: user.name,
      username: user.username,
      email: user.email,
      location: user.location ?? undefined,
      preferredLanguage: user.preferredLanguage,
      storageQuota: user.storageQuota,
      primaryGroupId: user.primaryGroupId ?? undefined,
      memberGroupIds: user.memberships.map((m) => m.groupId),
      ownerGroupIds: user.ownerships.map((o) => o.groupId),
    }

    const { ldapSyncEventId, discourseSyncEventId } = await prisma.$transaction(async (tx) => {
      const syncEvent = await createSyncEvent(tx, {
        target: 'LDAP',
        operation: 'DELETE',
        entityType: 'USER',
        entityId: user.id,
        payload: { ldapDn: user.ldapDn ?? '', username: user.username },
      })
      const discourseEv = await createSyncEvent(tx, {
        target: 'DISCOURSE',
        operation: 'DELETE',
        entityType: 'USER',
        entityId: user.id,
        payload: { username: user.username },
      })
      await tx.user.delete({ where: { id: user.id } })
      return { ldapSyncEventId: syncEvent.id, discourseSyncEventId: discourseEv.id }
    })
    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    await dispatchDiscourseSyncAfterCommit(discourseSyncEventId, 'DISCOURSE')

    await createAuditLog({
      actorId: session.user.id,
      action: 'DELETE',
      entityType: 'USER',
      entityId: user.id,
      oldValue,
      entityName: user.name,
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

// Get users for select/dropdown (minimal fields)
export async function getUsersForSelect() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true },
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
