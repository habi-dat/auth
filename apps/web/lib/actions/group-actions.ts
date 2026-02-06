'use server'

import { createAuditLog } from '@/lib/audit'
import { canManageGroup } from '@/lib/auth/roles'
import { getCurrentUserWithGroups } from '@/lib/auth/session'
import { GROUPADMIN_GROUP_SLUG } from '@/lib/constants'
import {
  createSyncEvent,
  dispatchDiscourseSyncAfterCommit,
  dispatchLdapSyncAfterCommit,
} from '@/lib/sync/create-sync-event'
import { type Prisma, prisma } from '@habidat/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { adminAction, groupAdminAction } from './client'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Schema definitions
const createGroupSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Slug can only contain letters, numbers, underscores, and hyphens'),
  description: z.string().min(1, 'Description is required'),
  memberUserIds: z.array(z.string()).optional(),
  ownerUserIds: z.array(z.string()).optional(),
  parentGroupIds: z.array(z.string()).optional(),
  childGroupIds: z.array(z.string()).optional(),
})

const updateGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  memberUserIds: z.array(z.string()).optional(),
  ownerUserIds: z.array(z.string()).optional(),
  parentGroupIds: z.array(z.string()).optional(),
  childGroupIds: z.array(z.string()).optional(),
})

const addMemberSchema = z.object({
  groupId: z.string(),
  userId: z.string(),
})

const removeMemberSchema = z.object({
  groupId: z.string(),
  userId: z.string(),
})

const addOwnerSchema = z.object({
  groupId: z.string(),
  userId: z.string(),
})

const removeOwnerSchema = z.object({
  groupId: z.string(),
  userId: z.string(),
})

async function getGroupAdminGroupId(tx: Tx) {
  const g = await tx.group.findUnique({
    where: { slug: GROUPADMIN_GROUP_SLUG },
    select: { id: true },
  })
  return g?.id ?? null
}

/** Add user to groupadmin group (GroupMembership) if groupadmin exists. Exported for use in user-actions. */
export async function addUserToGroupAdmin(tx: Tx, userId: string) {
  const groupAdminId = await getGroupAdminGroupId(tx)
  if (!groupAdminId) return
  await tx.groupMembership.upsert({
    where: { userId_groupId: { userId, groupId: groupAdminId } },
    create: { userId, groupId: groupAdminId },
    update: {},
  })
}

/** Remove user from groupadmin group if they have no other GroupOwnership. Exported for use in user-actions. */
export async function removeUserFromGroupAdminIfNoOwnership(tx: Tx, userId: string) {
  const groupAdminId = await getGroupAdminGroupId(tx)
  if (!groupAdminId) return
  const ownershipCount = await tx.groupOwnership.count({
    where: { userId },
  })
  if (ownershipCount === 0) {
    await tx.groupMembership.deleteMany({
      where: { userId, groupId: groupAdminId },
    })
  }
}

// Create group (admin only)
export const createGroupAction = adminAction
  .schema(createGroupSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    // Check slug uniqueness
    const existing = await prisma.group.findUnique({
      where: { slug: parsedInput.slug },
    })
    if (existing) {
      throw new Error('Group slug already exists')
    }

    const groupAdminGroup = await prisma.group.findUnique({
      where: { slug: GROUPADMIN_GROUP_SLUG },
      select: { id: true },
    })
    const groupAdminId = groupAdminGroup?.id ?? null
    const filteredParentGroupIds = (parsedInput.parentGroupIds ?? []).filter(
      (id) => id !== groupAdminId
    )
    const filteredChildGroupIds = (parsedInput.childGroupIds ?? []).filter(
      (id) => id !== groupAdminId
    )

    const { group, ldapSyncEventId, discourseSyncEventId, discourseUserSyncEventIds } =
      await prisma.$transaction(async (tx) => {
        const newGroup = await tx.group.create({
          data: {
            name: parsedInput.name,
            slug: parsedInput.slug,
            description: parsedInput.description,
          },
        })

        if (parsedInput.memberUserIds?.length) {
          await tx.groupMembership.createMany({
            data: parsedInput.memberUserIds.map((userId) => ({
              groupId: newGroup.id,
              userId,
            })),
          })
        }

        if (parsedInput.ownerUserIds?.length) {
          await tx.groupOwnership.createMany({
            data: parsedInput.ownerUserIds.map((userId) => ({
              groupId: newGroup.id,
              userId,
            })),
          })
          for (const userId of parsedInput.ownerUserIds) {
            await addUserToGroupAdmin(tx, userId)
          }
        }

        if (filteredParentGroupIds.length > 0) {
          await tx.groupHierarchy.createMany({
            data: filteredParentGroupIds.map((parentGroupId) => ({
              parentGroupId,
              childGroupId: newGroup.id,
            })),
          })
        }

        if (filteredChildGroupIds.length > 0) {
          await tx.groupHierarchy.createMany({
            data: filteredChildGroupIds.map((childGroupId) => ({
              parentGroupId: newGroup.id,
              childGroupId,
            })),
          })
        }

        const syncEvent = await createSyncEvent(tx, {
          target: 'LDAP',
          operation: 'CREATE',
          entityType: 'GROUP',
          entityId: newGroup.id,
          payload: { groupId: newGroup.id },
        })
        const discourseGroupEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'CREATE',
          entityType: 'GROUP',
          entityId: newGroup.id,
          payload: { groupId: newGroup.id },
        })
        const memberAndOwnerIds = [
          ...new Set([...(parsedInput.memberUserIds ?? []), ...(parsedInput.ownerUserIds ?? [])]),
        ]
        const discourseUserSyncEventIds: string[] = []
        for (const userId of memberAndOwnerIds) {
          const ev = await createSyncEvent(tx, {
            target: 'DISCOURSE',
            operation: 'UPDATE',
            entityType: 'USER',
            entityId: userId,
            payload: { userId },
          })
          discourseUserSyncEventIds.push(ev.id)
        }
        return {
          group: newGroup,
          ldapSyncEventId: syncEvent.id,
          discourseSyncEventId: discourseGroupEv.id,
          discourseUserSyncEventIds,
        }
      })

    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    await dispatchDiscourseSyncAfterCommit(discourseSyncEventId, 'DISCOURSE')
    for (const id of discourseUserSyncEventIds) {
      await dispatchDiscourseSyncAfterCommit(id, 'DISCOURSE')
    }

    const newValue = {
      name: group.name,
      slug: group.slug,
      description: group.description,
      memberUserIds: [...(parsedInput.memberUserIds ?? [])],
      ownerUserIds: [...(parsedInput.ownerUserIds ?? [])],
      parentGroupIds: [...(parsedInput.parentGroupIds ?? [])],
      childGroupIds: [...(parsedInput.childGroupIds ?? [])],
    }
    await createAuditLog({
      actorId: session.user.id,
      action: 'CREATE',
      entityType: 'GROUP',
      entityId: group.id,
      newValue,
      entityName: group.name,
    })

    revalidatePath('/groups')
    return { group }
  })

// Update group (admin or group owner)
export const updateGroupAction = groupAdminAction
  .schema(updateGroupSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    if (!canManageGroup(session, parsedInput.id)) {
      throw new Error('You do not have permission to update this group')
    }

    const existingGroup = await prisma.group.findUniqueOrThrow({
      where: { id: parsedInput.id },
      include: {
        memberships: true,
        ownerships: true,
        parentGroups: true,
        childGroups: true,
      },
    })

    // Prevent updating system groups (except by admin)
    if (existingGroup.isSystem && !session.isAdmin) {
      throw new Error('System groups can only be modified by admins')
    }
    // groupadmin system group cannot be edited at all (membership is managed automatically)
    if (existingGroup.slug === GROUPADMIN_GROUP_SLUG) {
      throw new Error('The groupadmin system group cannot be edited')
    }

    const groupAdminGroup = await prisma.group.findUnique({
      where: { slug: GROUPADMIN_GROUP_SLUG },
      select: { id: true },
    })
    const groupAdminId = groupAdminGroup?.id ?? null
    const filteredParentGroupIds = (parsedInput.parentGroupIds ?? []).filter(
      (id) => id !== groupAdminId
    )
    const filteredChildGroupIds = (parsedInput.childGroupIds ?? []).filter(
      (id) => id !== groupAdminId
    )

    const { group, ldapSyncEventId, discourseSyncEventId, discourseUserSyncEventIds } =
      await prisma.$transaction(async (tx) => {
        const updated = await tx.group.update({
          where: { id: parsedInput.id },
          data: {
            name: parsedInput.name,
            description: parsedInput.description,
          },
        })

        if (parsedInput.memberUserIds) {
          await tx.groupMembership.deleteMany({
            where: { groupId: parsedInput.id },
          })
          if (parsedInput.memberUserIds.length > 0) {
            await tx.groupMembership.createMany({
              data: parsedInput.memberUserIds.map((userId) => ({
                groupId: parsedInput.id,
                userId,
              })),
            })
          }
        }

        if (parsedInput.ownerUserIds && session.isAdmin) {
          const oldOwnerIds = existingGroup.ownerships.map((o) => o.userId)
          await tx.groupOwnership.deleteMany({
            where: { groupId: parsedInput.id },
          })
          if (parsedInput.ownerUserIds.length > 0) {
            await tx.groupOwnership.createMany({
              data: parsedInput.ownerUserIds.map((userId) => ({
                groupId: parsedInput.id,
                userId,
              })),
            })
            for (const userId of parsedInput.ownerUserIds) {
              await addUserToGroupAdmin(tx, userId)
            }
          }
          for (const userId of oldOwnerIds) {
            if (!parsedInput.ownerUserIds?.includes(userId)) {
              await removeUserFromGroupAdminIfNoOwnership(tx, userId)
            }
          }
        }

        if (parsedInput.parentGroupIds) {
          await tx.groupHierarchy.deleteMany({
            where: { childGroupId: parsedInput.id },
          })
          if (filteredParentGroupIds.length > 0) {
            await tx.groupHierarchy.createMany({
              data: filteredParentGroupIds.map((parentGroupId) => ({
                parentGroupId,
                childGroupId: parsedInput.id,
              })),
            })
          }
        }

        if (parsedInput.childGroupIds) {
          await tx.groupHierarchy.deleteMany({
            where: { parentGroupId: parsedInput.id },
          })
          if (filteredChildGroupIds.length > 0) {
            await tx.groupHierarchy.createMany({
              data: filteredChildGroupIds.map((childGroupId) => ({
                parentGroupId: parsedInput.id,
                childGroupId,
              })),
            })
          }
        }

        const groupWithRels = await tx.group.findUniqueOrThrow({
          where: { id: updated.id },
          include: { memberships: true, ownerships: true },
        })
        const memberUserIds = groupWithRels.memberships.map((m) => m.userId)
        const ownerUserIds = groupWithRels.ownerships.map((o) => o.userId)
        const allUserIds = [...new Set([...memberUserIds, ...ownerUserIds])]

        const syncEvent = await createSyncEvent(tx, {
          target: 'LDAP',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: updated.id,
          payload: { groupId: updated.id },
        })
        const discourseGroupEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: updated.id,
          payload: { groupId: updated.id, oldSlug: existingGroup.slug },
        })
        const discourseUserSyncEventIds: string[] = []
        for (const userId of allUserIds) {
          const ev = await createSyncEvent(tx, {
            target: 'DISCOURSE',
            operation: 'UPDATE',
            entityType: 'USER',
            entityId: userId,
            payload: { userId },
          })
          discourseUserSyncEventIds.push(ev.id)
        }
        return {
          group: updated,
          ldapSyncEventId: syncEvent.id,
          discourseSyncEventId: discourseGroupEv.id,
          discourseUserSyncEventIds,
        }
      })

    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    await dispatchDiscourseSyncAfterCommit(discourseSyncEventId, 'DISCOURSE')
    for (const id of discourseUserSyncEventIds) {
      await dispatchDiscourseSyncAfterCommit(id, 'DISCOURSE')
    }

    const updatedWithRels = await prisma.group.findUniqueOrThrow({
      where: { id: group.id },
      include: {
        memberships: true,
        ownerships: true,
        parentGroups: true,
        childGroups: true,
      },
    })
    const oldValue = {
      name: existingGroup.name,
      description: existingGroup.description,
      memberUserIds: existingGroup.memberships.map((m) => m.userId),
      ownerUserIds: existingGroup.ownerships.map((o) => o.userId),
      parentGroupIds: existingGroup.parentGroups.map((p) => p.parentGroupId),
      childGroupIds: existingGroup.childGroups.map((c) => c.childGroupId),
    }
    const newValue = {
      name: updatedWithRels.name,
      description: updatedWithRels.description,
      memberUserIds: updatedWithRels.memberships.map((m) => m.userId),
      ownerUserIds: updatedWithRels.ownerships.map((o) => o.userId),
      parentGroupIds: updatedWithRels.parentGroups.map((p) => p.parentGroupId),
      childGroupIds: updatedWithRels.childGroups.map((c) => c.childGroupId),
    }
    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: group.id,
      oldValue,
      newValue,
      entityName: group.name,
    })

    revalidatePath('/groups')
    revalidatePath(`/groups/${group.id}`)
    return { group }
  })

// Delete group (admin only)
export const deleteGroupAction = adminAction
  .schema(z.object({ groupId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    const group = await prisma.group.findUniqueOrThrow({
      where: { id: parsedInput.groupId },
      include: {
        memberships: true,
        ownerships: true,
        parentGroups: true,
        childGroups: true,
      },
    })

    // Prevent deleting system groups
    if (group.isSystem) {
      throw new Error('System groups cannot be deleted')
    }

    const oldValue = {
      name: group.name,
      slug: group.slug,
      description: group.description,
      memberUserIds: group.memberships.map((m) => m.userId),
      ownerUserIds: group.ownerships.map((o) => o.userId),
      parentGroupIds: group.parentGroups.map((p) => p.parentGroupId),
      childGroupIds: group.childGroups.map((c) => c.childGroupId),
    }

    const { ldapSyncEventId, discourseSyncEventId } = await prisma.$transaction(async (tx) => {
      const syncEvent = await createSyncEvent(tx, {
        target: 'LDAP',
        operation: 'DELETE',
        entityType: 'GROUP',
        entityId: group.id,
        payload: { ldapDn: group.ldapDn ?? '', slug: group.slug },
      })
      const discourseEv = await createSyncEvent(tx, {
        target: 'DISCOURSE',
        operation: 'DELETE',
        entityType: 'GROUP',
        entityId: group.id,
        payload: {
          groupId: group.id,
          discourseId: group.discourseId ?? undefined,
          slug: group.slug,
        },
      })
      await tx.group.delete({ where: { id: group.id } })
      return { ldapSyncEventId: syncEvent.id, discourseSyncEventId: discourseEv.id }
    })
    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    await dispatchDiscourseSyncAfterCommit(discourseSyncEventId, 'DISCOURSE')

    await createAuditLog({
      actorId: session.user.id,
      action: 'DELETE',
      entityType: 'GROUP',
      entityId: group.id,
      oldValue,
      entityName: group.name,
    })

    revalidatePath('/groups')
    return { success: true }
  })

// Add member to group
export const addMemberAction = groupAdminAction
  .schema(addMemberSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    const group = await prisma.group.findUniqueOrThrow({
      where: { id: parsedInput.groupId },
      include: { memberships: true },
    })
    if (!canManageGroup(session, parsedInput.groupId)) {
      throw new Error('You do not have permission to manage this group')
    }
    if (group.slug === GROUPADMIN_GROUP_SLUG) {
      throw new Error('The groupadmin system group membership is managed automatically')
    }
    const existing = await prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId: parsedInput.userId,
          groupId: parsedInput.groupId,
        },
      },
    })

    if (existing) {
      throw new Error('User is already a member of this group')
    }

    const oldMemberIds = group.memberships.map((m) => m.userId)
    const { ldapSyncEventId, discourseGroupSyncEventId, discourseUserSyncEventId } =
      await prisma.$transaction(async (tx) => {
        await tx.groupMembership.create({
          data: {
            userId: parsedInput.userId,
            groupId: parsedInput.groupId,
          },
        })
        const ev = await createSyncEvent(tx, {
          target: 'LDAP',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: parsedInput.groupId,
          payload: { groupId: parsedInput.groupId },
        })
        const discourseGroupEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: parsedInput.groupId,
          payload: { groupId: parsedInput.groupId },
        })
        const discourseUserEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'USER',
          entityId: parsedInput.userId,
          payload: { userId: parsedInput.userId },
        })
        return {
          ldapSyncEventId: ev.id,
          discourseGroupSyncEventId: discourseGroupEv.id,
          discourseUserSyncEventId: discourseUserEv.id,
        }
      })
    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    await dispatchDiscourseSyncAfterCommit(discourseGroupSyncEventId, 'DISCOURSE')
    await dispatchDiscourseSyncAfterCommit(discourseUserSyncEventId, 'DISCOURSE')

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: parsedInput.groupId,
      oldValue: { memberUserIds: oldMemberIds },
      newValue: { memberUserIds: [...oldMemberIds, parsedInput.userId] },
      entityName: group.name,
    })

    revalidatePath('/groups')
    revalidatePath(`/groups/${parsedInput.groupId}`)
    return { success: true }
  })

// Remove member from group
export const removeMemberAction = groupAdminAction
  .schema(removeMemberSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    const group = await prisma.group.findUniqueOrThrow({
      where: { id: parsedInput.groupId },
      include: { memberships: true },
    })
    if (!canManageGroup(session, parsedInput.groupId)) {
      throw new Error('You do not have permission to manage this group')
    }
    if (group.slug === GROUPADMIN_GROUP_SLUG) {
      throw new Error('The groupadmin system group membership is managed automatically')
    }

    const oldMemberIds = group.memberships.map((m) => m.userId)
    const { ldapSyncEventId, discourseGroupSyncEventId, discourseUserSyncEventId } =
      await prisma.$transaction(async (tx) => {
        await tx.groupMembership.delete({
          where: {
            userId_groupId: {
              userId: parsedInput.userId,
              groupId: parsedInput.groupId,
            },
          },
        })
        const ev = await createSyncEvent(tx, {
          target: 'LDAP',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: parsedInput.groupId,
          payload: { groupId: parsedInput.groupId },
        })
        const discourseGroupEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: parsedInput.groupId,
          payload: { groupId: parsedInput.groupId },
        })
        const discourseUserEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'USER',
          entityId: parsedInput.userId,
          payload: { userId: parsedInput.userId },
        })
        return {
          ldapSyncEventId: ev.id,
          discourseGroupSyncEventId: discourseGroupEv.id,
          discourseUserSyncEventId: discourseUserEv.id,
        }
      })
    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    await dispatchDiscourseSyncAfterCommit(discourseGroupSyncEventId, 'DISCOURSE')
    await dispatchDiscourseSyncAfterCommit(discourseUserSyncEventId, 'DISCOURSE')

    const newMemberIds = oldMemberIds.filter((id) => id !== parsedInput.userId)
    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: parsedInput.groupId,
      oldValue: { memberUserIds: oldMemberIds },
      newValue: { memberUserIds: newMemberIds },
      entityName: group.name,
    })

    revalidatePath('/groups')
    revalidatePath(`/groups/${parsedInput.groupId}`)
    return { success: true }
  })

// Add owner to group (group admin or system admin); auto-add as member if not already
export const addOwnerAction = groupAdminAction
  .schema(addOwnerSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    if (!canManageGroup(session, parsedInput.groupId)) {
      throw new Error('You do not have permission to manage this group')
    }

    const group = await prisma.group.findUniqueOrThrow({
      where: { id: parsedInput.groupId },
      include: { ownerships: true },
    })
    if (group.slug === GROUPADMIN_GROUP_SLUG) {
      throw new Error('The groupadmin system group membership is managed automatically')
    }
    const existingOwner = await prisma.groupOwnership.findUnique({
      where: {
        userId_groupId: {
          userId: parsedInput.userId,
          groupId: parsedInput.groupId,
        },
      },
    })

    if (existingOwner) {
      throw new Error('User is already an owner of this group')
    }

    const oldOwnerIds = group.ownerships.map((o) => o.userId)
    // Ensure user is a member (owners are always members)
    const existingMember = await prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId: parsedInput.userId,
          groupId: parsedInput.groupId,
        },
      },
    })

    const { ldapSyncEventId, discourseGroupSyncEventId, discourseUserSyncEventId } =
      await prisma.$transaction(async (tx) => {
        if (!existingMember) {
          await tx.groupMembership.create({
            data: {
              userId: parsedInput.userId,
              groupId: parsedInput.groupId,
            },
          })
        }
        await tx.groupOwnership.create({
          data: {
            userId: parsedInput.userId,
            groupId: parsedInput.groupId,
          },
        })
        await addUserToGroupAdmin(tx, parsedInput.userId)
        const ev = await createSyncEvent(tx, {
          target: 'LDAP',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: parsedInput.groupId,
          payload: { groupId: parsedInput.groupId },
        })
        const discourseGroupEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: parsedInput.groupId,
          payload: { groupId: parsedInput.groupId },
        })
        const discourseUserEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'USER',
          entityId: parsedInput.userId,
          payload: { userId: parsedInput.userId },
        })
        return {
          ldapSyncEventId: ev.id,
          discourseGroupSyncEventId: discourseGroupEv.id,
          discourseUserSyncEventId: discourseUserEv.id,
        }
      })
    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    await dispatchDiscourseSyncAfterCommit(discourseGroupSyncEventId, 'DISCOURSE')
    await dispatchDiscourseSyncAfterCommit(discourseUserSyncEventId, 'DISCOURSE')

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: parsedInput.groupId,
      oldValue: { ownerUserIds: oldOwnerIds },
      newValue: { ownerUserIds: [...oldOwnerIds, parsedInput.userId] },
      entityName: group.name,
    })

    revalidatePath('/groups')
    revalidatePath(`/groups/${parsedInput.groupId}`)
    return { success: true }
  })

// Remove owner from group (group admin or system admin)
export const removeOwnerAction = groupAdminAction
  .schema(removeOwnerSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    const group = await prisma.group.findUniqueOrThrow({
      where: { id: parsedInput.groupId },
      include: { ownerships: true },
    })
    if (!canManageGroup(session, parsedInput.groupId)) {
      throw new Error('You do not have permission to manage this group')
    }
    if (group.slug === GROUPADMIN_GROUP_SLUG) {
      throw new Error('The groupadmin system group membership is managed automatically')
    }

    const oldOwnerIds = group.ownerships.map((o) => o.userId)
    const { ldapSyncEventId, discourseGroupSyncEventId, discourseUserSyncEventId } =
      await prisma.$transaction(async (tx) => {
        await tx.groupOwnership.delete({
          where: {
            userId_groupId: {
              userId: parsedInput.userId,
              groupId: parsedInput.groupId,
            },
          },
        })
        await removeUserFromGroupAdminIfNoOwnership(tx, parsedInput.userId)
        const ev = await createSyncEvent(tx, {
          target: 'LDAP',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: parsedInput.groupId,
          payload: { groupId: parsedInput.groupId },
        })
        const discourseGroupEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'GROUP',
          entityId: parsedInput.groupId,
          payload: { groupId: parsedInput.groupId },
        })
        const discourseUserEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'USER',
          entityId: parsedInput.userId,
          payload: { userId: parsedInput.userId },
        })
        return {
          ldapSyncEventId: ev.id,
          discourseGroupSyncEventId: discourseGroupEv.id,
          discourseUserSyncEventId: discourseUserEv.id,
        }
      })
    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    await dispatchDiscourseSyncAfterCommit(discourseGroupSyncEventId, 'DISCOURSE')
    await dispatchDiscourseSyncAfterCommit(discourseUserSyncEventId, 'DISCOURSE')

    const newOwnerIds = oldOwnerIds.filter((id) => id !== parsedInput.userId)
    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: parsedInput.groupId,
      oldValue: { ownerUserIds: oldOwnerIds },
      newValue: { ownerUserIds: newOwnerIds },
      entityName: group.name,
    })

    revalidatePath('/groups')
    revalidatePath(`/groups/${parsedInput.groupId}`)
    return { success: true }
  })

// Get groups (for list page)
export async function getGroups(search?: string) {
  const session = await getCurrentUserWithGroups()
  if (!session) return []

  const where: Prisma.GroupWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {}

  // If not system admin, restrict to owned groups
  if (!session.isAdmin) {
    where.ownerships = {
      some: {
        userId: session.user.id,
      },
    }
  }

  return prisma.group.findMany({
    where,
    include: {
      memberships: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      ownerships: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      parentGroups: {
        include: {
          parentGroup: { select: { id: true, name: true, slug: true } },
        },
      },
      childGroups: {
        include: {
          childGroup: { select: { id: true, name: true, slug: true } },
        },
      },
      _count: {
        select: { memberships: true },
      },
    },
    orderBy: { name: 'asc' },
  })
}

// Get single group
export async function getGroup(id: string) {
  return prisma.group.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, name: true, email: true, username: true } },
        },
      },
      ownerships: {
        include: {
          user: { select: { id: true, name: true, email: true, username: true } },
        },
      },
      parentGroups: {
        include: {
          parentGroup: { select: { id: true, name: true, slug: true } },
        },
      },
      childGroups: {
        include: {
          childGroup: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  })
}

// Get groups for select dropdown
export async function getGroupsForSelect() {
  return prisma.group.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })
}
