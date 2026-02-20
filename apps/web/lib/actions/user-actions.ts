'use server'

import { canManageGroup, canManageUser } from '@habidat/auth/roles'
import { prisma } from '@habidat/db'
import { hashPassword } from 'better-auth/crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  addUserToGroupAdmin,
  removeUserFromGroupAdminIfNoOwnership,
} from '@/lib/actions/group-actions'
import { createAuditLog } from '@/lib/audit'
import { ADMIN_GROUP_SLUG, GROUPADMIN_GROUP_SLUG } from '@/lib/constants'
import { hashPasswordSsha } from '@/lib/ldap/password'
import {
  createSyncEvent,
  dispatchDiscourseSyncAfterCommit,
  dispatchLdapSyncAfterCommit,
} from '@/lib/sync/create-sync-event'
import { groupAdminAction, userAction } from './client'

const SYSTEM_GROUP_SLUGS = [ADMIN_GROUP_SLUG, GROUPADMIN_GROUP_SLUG]

const NAME_REGEX = /^[^"(),=`<>]{2,}[^"(),=`<> ]+$/

// Schema definitions
const createUserSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .regex(NAME_REGEX, 'Name must be at least 3 characters and cannot contain "(),=<>'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  location: z.string().min(1, 'Location is required'),
  preferredLanguage: z.string().default('de'),
  storageQuota: z.string().default('1 GB'),
  memberGroupIds: z.array(z.string()),
  ownerGroupIds: z.array(z.string()).optional(),
  primaryGroupId: z.string().optional().nullable(),
})

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(3).regex(NAME_REGEX).optional(),
  email: z.email().optional(),
  location: z.string().min(1).optional().nullable(),
  preferredLanguage: z.string().optional(),
  storageQuota: z.string().optional(),
  memberGroupIds: z.array(z.string()).optional(),
  ownerGroupIds: z.array(z.string()).optional(),
  primaryGroupId: z.string().optional().nullable(),
})

const updateProfileSchema = z.object({
  name: z.string().min(3).regex(NAME_REGEX),
  location: z.string().min(1).optional().nullable(),
  preferredLanguage: z.string(),
  preferredColorMode: z.enum(['light', 'dark', 'system']).optional().nullable(),
  primaryGroupId: z.string().optional().nullable(),
})

// Create user action (group admin or admin)
export const createUserAction = groupAdminAction
  .schema(createUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    // groupadmin system group cannot be assigned manually (membership is automatic)
    const groupAdminGroup = await prisma.group.findUnique({
      where: { slug: GROUPADMIN_GROUP_SLUG },
      select: { id: true },
    })
    const groupAdminId = groupAdminGroup?.id ?? null
    const memberGroupIds = groupAdminId
      ? parsedInput.memberGroupIds.filter((id) => id !== groupAdminId)
      : parsedInput.memberGroupIds
    const ownerGroupIds =
      (groupAdminId && parsedInput.ownerGroupIds
        ? parsedInput.ownerGroupIds.filter((id) => id !== groupAdminId)
        : parsedInput.ownerGroupIds) ?? []

    if (memberGroupIds.length === 0 && ownerGroupIds.length === 0) {
      throw new Error('User must belong to at least one group (excluding system groups)')
    }

    const effectiveMemberGroupIds = [...new Set([...memberGroupIds, ...ownerGroupIds])]
    const primaryGroupId =
      parsedInput.primaryGroupId && effectiveMemberGroupIds.includes(parsedInput.primaryGroupId)
        ? parsedInput.primaryGroupId
        : (memberGroupIds[0] ?? ownerGroupIds[0] ?? null)
    if (effectiveMemberGroupIds.length > 0 && !primaryGroupId) {
      throw new Error('Primary group is required when user is a member of at least one group')
    }

    // Verify actor can add to all specified groups
    for (const groupId of memberGroupIds) {
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
    const {
      user,
      ldapSyncEventId,
      groupSyncEventIds,
      discourseSyncEventId,
      discourseGroupSyncEventIds,
    } = await prisma.$transaction(async (tx) => {
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
          primaryGroupId,
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

      if (effectiveMemberGroupIds.length > 0) {
        await tx.groupMembership.createMany({
          data: effectiveMemberGroupIds.map((groupId) => ({
            userId: newUser.id,
            groupId,
          })),
        })
      }

      if (ownerGroupIds.length > 0) {
        await tx.groupOwnership.createMany({
          data: ownerGroupIds.map((groupId) => ({
            userId: newUser.id,
            groupId,
          })),
        })
        await addUserToGroupAdmin(tx, newUser.id)
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
      memberGroupIds: [...memberGroupIds],
      ownerGroupIds: [...ownerGroupIds],
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
      include: {
        memberships: {
          include: { group: { select: { id: true, slug: true, isSystem: true, name: true } } },
        },
        ownerships: true,
      },
    })

    if (!canManageUser(session, existingUser.memberships)) {
      throw new Error('You do not have permission to update this user')
    }

    const systemGroups = await prisma.group.findMany({
      where: { isSystem: true },
      select: { id: true, slug: true },
    })
    const systemGroupIds = new Set(systemGroups.map((g) => g.id))

    // Group admins can only change group memberships, ownerships, and primaryGroupId -- not profile fields
    const isActorAdmin = session.isAdmin
    const profileData = isActorAdmin
      ? {
          name: parsedInput.name,
          email: parsedInput.email,
          location: parsedInput.location,
          preferredLanguage: parsedInput.preferredLanguage,
          storageQuota: parsedInput.storageQuota,
        }
      : {}

    // Filter out system groups from input
    const memberGroupIds = parsedInput.memberGroupIds
      ? parsedInput.memberGroupIds.filter((id) => !systemGroupIds.has(id))
      : undefined
    const ownerGroupIds = parsedInput.ownerGroupIds
      ? parsedInput.ownerGroupIds.filter((id) => !systemGroupIds.has(id))
      : undefined
    const primaryGroupId = parsedInput.primaryGroupId

    // Managed group IDs for the acting user (used to scope group admin changes)
    const managedGroupIds = isActorAdmin ? null : new Set(session.ownerships.map((o) => o.groupId))

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
      // Compute effective membership/ownership lists, scoped to the actor's permissions
      let effectiveMemberGroupIds: string[] | undefined
      if (memberGroupIds !== undefined) {
        if (managedGroupIds) {
          // Group admin: only modify groups they own, preserve all others
          const preservedMemberships = existingUser.memberships
            .filter((m) => !managedGroupIds.has(m.groupId))
            .map((m) => m.groupId)
          effectiveMemberGroupIds = [...new Set([...preservedMemberships, ...memberGroupIds])]
          for (const groupId of memberGroupIds) {
            if (!canManageGroup(session, groupId)) {
              throw new Error('You cannot add users to this group')
            }
          }
        } else {
          effectiveMemberGroupIds = memberGroupIds
        }
      }

      let effectiveOwnerGroupIds: string[] | undefined
      if (ownerGroupIds !== undefined) {
        if (managedGroupIds) {
          const preservedOwnerships = existingUser.ownerships
            .filter((o) => !managedGroupIds.has(o.groupId))
            .map((o) => o.groupId)
          effectiveOwnerGroupIds = [...new Set([...preservedOwnerships, ...ownerGroupIds])]
          for (const groupId of ownerGroupIds) {
            if (!canManageGroup(session, groupId)) {
              throw new Error('You cannot change ownership for this group')
            }
          }
        } else {
          effectiveOwnerGroupIds = ownerGroupIds
        }
      }

      // Ensure owners are also members
      const allMemberIds =
        effectiveMemberGroupIds !== undefined
          ? [...new Set([...effectiveMemberGroupIds, ...(effectiveOwnerGroupIds ?? [])])]
          : undefined

      const afterGroupIdsForPrimary =
        allMemberIds !== undefined
          ? allMemberIds
          : [
              ...new Set([
                ...existingUser.memberships.map((m) => m.groupId),
                ...existingUser.ownerships.map((o) => o.groupId),
              ]),
            ]
      const primaryGroupIdValid =
        primaryGroupId == null ||
        (afterGroupIdsForPrimary.length > 0 && afterGroupIdsForPrimary.includes(primaryGroupId))
      if (!primaryGroupIdValid) {
        throw new Error("Primary group must be one of the user's member groups")
      }

      const updated = await tx.user.update({
        where: { id: parsedInput.id },
        data: {
          ...profileData,
          ...(primaryGroupId !== undefined ? { primaryGroupId } : {}),
        },
      })

      let afterGroupIds: string[] | null = null
      if (allMemberIds !== undefined) {
        afterGroupIds = allMemberIds
        // Remove non-system memberships and re-create (system group memberships are preserved)
        await tx.groupMembership.deleteMany({
          where: {
            userId: parsedInput.id,
            group: { isSystem: false },
          },
        })
        const nonSystemMemberIds = allMemberIds.filter((id) => !systemGroupIds.has(id))
        if (nonSystemMemberIds.length > 0) {
          await tx.groupMembership.createMany({
            data: nonSystemMemberIds.map((groupId) => ({
              userId: parsedInput.id,
              groupId,
            })),
          })
        }
      }

      if (effectiveOwnerGroupIds !== undefined) {
        await tx.groupOwnership.deleteMany({
          where: { userId: parsedInput.id },
        })
        if (effectiveOwnerGroupIds.length > 0) {
          await tx.groupOwnership.createMany({
            data: effectiveOwnerGroupIds.map((groupId) => ({
              userId: parsedInput.id,
              groupId,
            })),
          })
        }
        if (!afterGroupIds) {
          afterGroupIds = [
            ...new Set([
              ...existingUser.memberships.map((m) => m.groupId),
              ...effectiveOwnerGroupIds,
            ]),
          ]
        }
        await removeUserFromGroupAdminIfNoOwnership(tx, parsedInput.id)
        if (effectiveOwnerGroupIds.length > 0) {
          await addUserToGroupAdmin(tx, parsedInput.id)
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
      include: { memberships: { select: { groupId: true } } },
    })
    const memberGroupIds = oldUser.memberships.map((m) => m.groupId)
    if (parsedInput.primaryGroupId != null && memberGroupIds.length > 0) {
      if (!memberGroupIds.includes(parsedInput.primaryGroupId)) {
        throw new Error('Primary group must be one of your member groups')
      }
    }

    const { user, ldapSyncEventId, discourseSyncEventId } = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.user.update({
          where: { id: session.user.id },
          data: {
            name: parsedInput.name,
            location: parsedInput.location,
            preferredLanguage: parsedInput.preferredLanguage,
            preferredColorMode: parsedInput.preferredColorMode,
            primaryGroupId: parsedInput.primaryGroupId,
          },
        })
        const ldapSyncEvent = await createSyncEvent(tx, {
          target: 'LDAP',
          operation: 'UPDATE',
          entityType: 'USER',
          entityId: updated.id,
          payload: { userId: updated.id },
        })
        const discourseSyncEvent = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'USER',
          entityId: updated.id,
          payload: { userId: updated.id },
        })
        return {
          user: updated,
          ldapSyncEventId: ldapSyncEvent.id,
          discourseSyncEventId: discourseSyncEvent.id,
        }
      }
    )
    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    await dispatchDiscourseSyncAfterCommit(discourseSyncEventId, 'DISCOURSE')

    const oldValue = {
      name: oldUser.name,
      location: oldUser.location ?? undefined,
      preferredLanguage: oldUser.preferredLanguage,
      preferredColorMode: oldUser.preferredColorMode ?? undefined,
      primaryGroupId: oldUser.primaryGroupId ?? undefined,
    }
    const newValue = {
      name: user.name,
      location: user.location ?? undefined,
      preferredLanguage: user.preferredLanguage,
      preferredColorMode: user.preferredColorMode ?? undefined,
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
      include: {
        memberships: {
          include: { group: { select: { id: true, slug: true, name: true, isSystem: true } } },
        },
        ownerships: true,
      },
    })

    // Prevent deleting yourself
    if (user.id === session.user.id) {
      throw new Error('You cannot delete your own account')
    }

    if (!session.isAdmin) {
      // Group admins cannot delete users who are in any system group
      const systemMemberships = user.memberships.filter((m) =>
        SYSTEM_GROUP_SLUGS.includes(m.group.slug)
      )
      if (systemMemberships.length > 0) {
        throw new Error(
          'This user is a member of system groups and can only be deleted by a system admin'
        )
      }

      // Group admins can only delete users whose non-system groups are ALL owned by the actor
      const ownedGroupIds = new Set(session.ownerships.map((o) => o.groupId))
      const nonOwnedGroups = user.memberships
        .filter((m) => !m.group.isSystem && !ownedGroupIds.has(m.groupId))
        .map((m) => m.group.name)
      if (nonOwnedGroups.length > 0) {
        throw new Error(
          `User is a member of groups you do not manage (${nonOwnedGroups.join(', ')}). ` +
            'Contact the group admins of those groups, or remove the user from your groups instead of deleting.'
        )
      }
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
