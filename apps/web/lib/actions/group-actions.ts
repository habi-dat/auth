'use server'

import { createAuditLog } from '@/lib/audit'
import { canManageGroup } from '@/lib/auth/roles'
import { prisma } from '@habidat/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { adminAction, groupAdminAction } from './client'

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

    const group = await prisma.$transaction(async (tx) => {
      // Create group
      const newGroup = await tx.group.create({
        data: {
          name: parsedInput.name,
          slug: parsedInput.slug,
          description: parsedInput.description,
        },
      })

      // Add members
      if (parsedInput.memberUserIds?.length) {
        await tx.groupMembership.createMany({
          data: parsedInput.memberUserIds.map((userId) => ({
            groupId: newGroup.id,
            userId,
          })),
        })
      }

      // Add owners
      if (parsedInput.ownerUserIds?.length) {
        await tx.groupOwnership.createMany({
          data: parsedInput.ownerUserIds.map((userId) => ({
            groupId: newGroup.id,
            userId,
          })),
        })
      }

      // Add parent relationships
      if (parsedInput.parentGroupIds?.length) {
        await tx.groupHierarchy.createMany({
          data: parsedInput.parentGroupIds.map((parentGroupId) => ({
            parentGroupId,
            childGroupId: newGroup.id,
          })),
        })
      }

      // Add child relationships
      if (parsedInput.childGroupIds?.length) {
        await tx.groupHierarchy.createMany({
          data: parsedInput.childGroupIds.map((childGroupId) => ({
            parentGroupId: newGroup.id,
            childGroupId,
          })),
        })
      }

      return newGroup
    })

    await createAuditLog({
      actorId: session.user.id,
      action: 'CREATE',
      entityType: 'GROUP',
      entityId: group.id,
      newValue: { name: group.name, slug: group.slug },
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
    })

    // Prevent updating system groups (except by admin)
    if (existingGroup.isSystem && !session.isAdmin) {
      throw new Error('System groups can only be modified by admins')
    }

    const group = await prisma.$transaction(async (tx) => {
      // Update group fields
      const updated = await tx.group.update({
        where: { id: parsedInput.id },
        data: {
          name: parsedInput.name,
          description: parsedInput.description,
        },
      })

      // Update members if provided
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

      // Update owners if provided (admin only)
      if (parsedInput.ownerUserIds && session.isAdmin) {
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
        }
      }

      // Update parent relationships if provided
      if (parsedInput.parentGroupIds) {
        await tx.groupHierarchy.deleteMany({
          where: { childGroupId: parsedInput.id },
        })
        if (parsedInput.parentGroupIds.length > 0) {
          await tx.groupHierarchy.createMany({
            data: parsedInput.parentGroupIds.map((parentGroupId) => ({
              parentGroupId,
              childGroupId: parsedInput.id,
            })),
          })
        }
      }

      // Update child relationships if provided
      if (parsedInput.childGroupIds) {
        await tx.groupHierarchy.deleteMany({
          where: { parentGroupId: parsedInput.id },
        })
        if (parsedInput.childGroupIds.length > 0) {
          await tx.groupHierarchy.createMany({
            data: parsedInput.childGroupIds.map((childGroupId) => ({
              parentGroupId: parsedInput.id,
              childGroupId,
            })),
          })
        }
      }

      return updated
    })

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: group.id,
      oldValue: { name: existingGroup.name },
      newValue: { name: group.name },
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
    })

    // Prevent deleting system groups
    if (group.isSystem) {
      throw new Error('System groups cannot be deleted')
    }

    await prisma.group.delete({ where: { id: group.id } })

    await createAuditLog({
      actorId: session.user.id,
      action: 'DELETE',
      entityType: 'GROUP',
      entityId: group.id,
      oldValue: { name: group.name, slug: group.slug },
    })

    revalidatePath('/groups')
    return { success: true }
  })

// Add member to group
export const addMemberAction = groupAdminAction
  .schema(addMemberSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    if (!canManageGroup(session, parsedInput.groupId)) {
      throw new Error('You do not have permission to manage this group')
    }

    // Check if already a member
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

    await prisma.groupMembership.create({
      data: {
        userId: parsedInput.userId,
        groupId: parsedInput.groupId,
      },
    })

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: parsedInput.groupId,
      metadata: { action: 'addMember', userId: parsedInput.userId },
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

    if (!canManageGroup(session, parsedInput.groupId)) {
      throw new Error('You do not have permission to manage this group')
    }

    await prisma.groupMembership.delete({
      where: {
        userId_groupId: {
          userId: parsedInput.userId,
          groupId: parsedInput.groupId,
        },
      },
    })

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: parsedInput.groupId,
      metadata: { action: 'removeMember', userId: parsedInput.userId },
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

    // Check if already an owner
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

    // Ensure user is a member (owners are always members)
    const existingMember = await prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId: parsedInput.userId,
          groupId: parsedInput.groupId,
        },
      },
    })

    if (!existingMember) {
      await prisma.groupMembership.create({
        data: {
          userId: parsedInput.userId,
          groupId: parsedInput.groupId,
        },
      })
    }

    await prisma.groupOwnership.create({
      data: {
        userId: parsedInput.userId,
        groupId: parsedInput.groupId,
      },
    })

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: parsedInput.groupId,
      metadata: { action: 'addOwner', userId: parsedInput.userId },
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

    if (!canManageGroup(session, parsedInput.groupId)) {
      throw new Error('You do not have permission to manage this group')
    }

    await prisma.groupOwnership.delete({
      where: {
        userId_groupId: {
          userId: parsedInput.userId,
          groupId: parsedInput.groupId,
        },
      },
    })

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: parsedInput.groupId,
      metadata: { action: 'removeOwner', userId: parsedInput.userId },
    })

    revalidatePath('/groups')
    revalidatePath(`/groups/${parsedInput.groupId}`)
    return { success: true }
  })

// Get groups (for list page)
export async function getGroups(search?: string) {
  return prisma.group.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
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
