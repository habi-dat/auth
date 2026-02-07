'use server'
import { canManageGroup } from '@habidat/auth/roles'
import { getCurrentUserWithGroups } from '@habidat/auth/session'
import { type Prisma, prisma } from '@habidat/db'
import { hashPassword } from 'better-auth/crypto'
import { addDays } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAuditLog } from '@/lib/audit'
import { sendEmail } from '@/lib/email/send'
import { renderInviteEmail } from '@/lib/email/templates'
import { hashPasswordSsha } from '@/lib/ldap/password'
import { createSyncEvent } from '@/lib/sync/create-sync-event'
import { actionClient, groupAdminAction } from './client'

export type InviteWithGroupsResult = {
  invite: { memberGroups: { groupId: string }[]; ownerGroups: { groupId: string }[] }
  groups: { id: string; name: string; slug: string }[]
} | null

const createInviteSchema = z.object({
  email: z.string().email(),
  memberGroupIds: z.array(z.string().cuid()).min(1),
  ownerGroupIds: z.array(z.string().cuid()).optional(),
})

export const createInviteAction = groupAdminAction
  .schema(createInviteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    for (const groupId of parsedInput.memberGroupIds) {
      if (!canManageGroup(session, groupId)) {
        throw new Error('You cannot add users to this group')
      }
    }
    for (const groupId of parsedInput.ownerGroupIds ?? []) {
      if (!canManageGroup(session, groupId)) {
        throw new Error('You cannot add owners to this group')
      }
    }

    const existingInvite = await prisma.invite.findFirst({
      where: {
        email: parsedInput.email,
        expiresAt: { gt: new Date() },
      },
    })
    if (existingInvite) {
      throw new Error('An invitation already exists for this email')
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: parsedInput.email },
    })
    if (existingUser) {
      throw new Error('A user with this email already exists')
    }

    const invite = await prisma.invite.create({
      data: {
        email: parsedInput.email,
        expiresAt: addDays(new Date(), 7),
        createdById: session.user.id,
        memberGroups: {
          create: parsedInput.memberGroupIds.map((groupId) => ({ groupId })),
        },
        ownerGroups: {
          create: (parsedInput.ownerGroupIds ?? []).map((groupId) => ({
            groupId,
          })),
        },
      },
      include: {
        createdBy: { select: { name: true } },
        memberGroups: true,
        ownerGroups: true,
      },
    })

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
    const inviteLink = `${appUrl}/accept-invite?token=${invite.token}`
    const { html, subject } = await renderInviteEmail({
      inviterName: invite.createdBy.name,
      inviteLink,
    })
    const { sent, error } = await sendEmail({
      to: parsedInput.email,
      subject,
      html,
    })
    if (!sent && error) {
      console.error('[Invite] Failed to send email:', error)
    }

    await createAuditLog({
      actorId: session.user.id,
      action: 'CREATE',
      entityType: 'INVITE',
      entityId: invite.id,
      newValue: {
        email: invite.email,
        memberGroupIds: parsedInput.memberGroupIds,
        ownerGroupIds: parsedInput.ownerGroupIds ?? [],
      },
      entityName: invite.email,
    })

    revalidatePath('/invites')
    return { invite, emailSent: sent }
  })

export async function getInvites() {
  return prisma.invite.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      memberGroups: { select: { groupId: true } },
      ownerGroups: { select: { groupId: true } },
    },
  })
}

/** Get invite by token (for accept-invite page). Returns null if not found or expired. */
export async function getInviteByToken(token: string): Promise<InviteWithGroupsResult> {
  if (!token.trim()) return null
  const invite = await prisma.invite.findFirst({
    where: { token: token.trim(), expiresAt: { gt: new Date() } },
    include: { memberGroups: true, ownerGroups: true },
  })
  if (!invite) return null
  const groupIds = [
    ...new Set([
      ...invite.memberGroups.map((mg) => mg.groupId),
      ...invite.ownerGroups.map((og) => og.groupId),
    ]),
  ]
  const groups =
    groupIds.length > 0
      ? await prisma.group.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, name: true, slug: true },
        })
      : []
  return { invite: { memberGroups: invite.memberGroups, ownerGroups: invite.ownerGroups }, groups }
}

export async function getGroupsForSelect() {
  const session = await getCurrentUserWithGroups()
  if (!session) return []

  const where: Prisma.GroupWhereInput = {}
  if (!session.isAdmin) {
    where.ownerships = {
      some: {
        userId: session.user.id,
      },
    }
  }

  return prisma.group.findMany({
    where,
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })
}

const deleteInvitesSchema = z.object({
  inviteIds: z.array(z.string().cuid()),
})

export const deleteInvitesAction = groupAdminAction
  .schema(deleteInvitesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    const invites = await prisma.invite.findMany({
      where: { id: { in: parsedInput.inviteIds } },
      include: { memberGroups: true, ownerGroups: true },
    })

    for (const invite of invites) {
      const canDelete =
        session.isAdmin ||
        invite.memberGroups.some((mg) =>
          session.ownerships.some((o) => o.groupId === mg.groupId)
        ) ||
        invite.ownerGroups.some((og) => session.ownerships.some((o) => o.groupId === og.groupId))
      if (!canDelete) {
        throw new Error(`Cannot delete invite ${invite.id}`)
      }
    }

    await prisma.invite.deleteMany({
      where: { id: { in: parsedInput.inviteIds } },
    })

    for (const invite of invites) {
      await createAuditLog({
        actorId: session.user.id,
        action: 'DELETE',
        entityType: 'INVITE',
        entityId: invite.id,
        oldValue: { email: invite.email },
        entityName: invite.email,
      })
    }

    revalidatePath('/invites')
    return { success: true }
  })

const resendInviteSchema = z.object({
  inviteId: z.string().cuid(),
})

export const resendInviteAction = groupAdminAction
  .schema(resendInviteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx

    const invite = await prisma.invite.findUnique({
      where: { id: parsedInput.inviteId },
      include: {
        createdBy: { select: { name: true } },
        memberGroups: true,
        ownerGroups: true,
      },
    })

    if (!invite) {
      throw new Error('Invite not found')
    }

    // Check permission
    const canResend =
      session.isAdmin ||
      invite.memberGroups.some((mg) => session.ownerships.some((o) => o.groupId === mg.groupId)) ||
      invite.ownerGroups.some((og) => session.ownerships.some((o) => o.groupId === og.groupId))
    if (!canResend) {
      throw new Error('Cannot resend this invite')
    }

    // Extend expiration by 7 days from now
    await prisma.invite.update({
      where: { id: invite.id },
      data: { expiresAt: addDays(new Date(), 7) },
    })

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
    const inviteLink = `${appUrl}/accept-invite?token=${invite.token}`
    const { html, subject } = await renderInviteEmail({
      inviterName: invite.createdBy?.name ?? session.user.name,
      inviteLink,
    })
    const { sent, error } = await sendEmail({
      to: invite.email,
      subject,
      html,
    })
    if (!sent && error) {
      console.error('[Invite] Failed to resend email:', error)
    }

    revalidatePath('/invites')
    return { success: true, emailSent: sent }
  })

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  primaryGroupId: z.string().cuid().optional().nullable(),
})

export const acceptInviteAction = actionClient
  .schema(acceptInviteSchema)
  .action(async ({ parsedInput }) => {
    const invite = await prisma.invite.findUnique({
      where: { token: parsedInput.token },
      include: {
        memberGroups: true,
        ownerGroups: true,
      },
    })

    if (!invite || invite.expiresAt < new Date()) {
      throw new Error('Invalid or expired invitation')
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: parsedInput.username }, { email: invite.email }],
      },
    })
    if (existing) {
      throw new Error('Username or email already exists')
    }

    const maxUid = await prisma.user.aggregate({
      _max: { ldapUidNumber: true },
    })
    const ldapUidNumber = (maxUid._max.ldapUidNumber ?? 10000) + 1
    const hashedPassword = await hashPassword(parsedInput.password)
    const ldapPasswordSsha = hashPasswordSsha(parsedInput.password)

    const effectiveMemberGroupIds = [
      ...new Set([
        ...invite.memberGroups.map((mg) => mg.groupId),
        ...invite.ownerGroups.map((og) => og.groupId),
      ]),
    ]
    const primaryGroupId =
      parsedInput.primaryGroupId && effectiveMemberGroupIds.includes(parsedInput.primaryGroupId)
        ? parsedInput.primaryGroupId
        : (invite.memberGroups[0]?.groupId ?? invite.ownerGroups[0]?.groupId ?? null)

    const { user, ldapSyncEventId, discourseSyncEventId, discourseGroupSyncEventIds } =
      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: parsedInput.name,
            username: parsedInput.username,
            email: invite.email,
            emailVerified: true,
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

        await tx.groupMembership.createMany({
          data: invite.memberGroups.map((mg) => ({
            userId: newUser.id,
            groupId: mg.groupId,
          })),
        })

        if (invite.ownerGroups.length > 0) {
          await tx.groupOwnership.createMany({
            data: invite.ownerGroups.map((og) => ({
              userId: newUser.id,
              groupId: og.groupId,
            })),
          })
        }

        const ldapEv = await createSyncEvent(tx, {
          target: 'LDAP',
          operation: 'CREATE',
          entityType: 'USER',
          entityId: newUser.id,
          payload: { userId: newUser.id, hashedPassword: ldapPasswordSsha },
        })
        const discourseUserEv = await createSyncEvent(tx, {
          target: 'DISCOURSE',
          operation: 'CREATE',
          entityType: 'USER',
          entityId: newUser.id,
          payload: { userId: newUser.id },
        })
        const discourseGroupIds: string[] = []
        const allGroupIds = [
          ...new Set([
            ...invite.memberGroups.map((mg) => mg.groupId),
            ...invite.ownerGroups.map((og) => og.groupId),
          ]),
        ]
        for (const groupId of allGroupIds) {
          const ev = await createSyncEvent(tx, {
            target: 'DISCOURSE',
            operation: 'UPDATE',
            entityType: 'GROUP',
            entityId: groupId,
            payload: { groupId },
          })
          discourseGroupIds.push(ev.id)
        }

        await tx.invite.delete({ where: { id: invite.id } })

        return {
          user: newUser,
          ldapSyncEventId: ldapEv.id,
          discourseSyncEventId: discourseUserEv.id,
          discourseGroupSyncEventIds: discourseGroupIds,
        }
      })

    const { queueLdapSync, queueDiscourseSync } = await import('@habidat/sync')
    await queueLdapSync(ldapSyncEventId)
    await queueDiscourseSync(discourseSyncEventId)
    for (const id of discourseGroupSyncEventIds) {
      await queueDiscourseSync(id)
    }

    await createAuditLog({
      actorId: user.id,
      action: 'CREATE',
      entityType: 'USER',
      entityId: user.id,
      newValue: { name: user.name, email: user.email, username: user.username },
      metadata: { via: 'invite', inviteId: invite.id },
      entityName: user.name,
    })

    return { user }
  })
