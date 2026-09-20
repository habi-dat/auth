'use server'
import { canManageGroup } from '@habidat/auth/roles'
import { requireGroupAdmin } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import { hashPassword } from 'better-auth/crypto'
import { addDays } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAuditLog } from '@/lib/audit'
import { sendEmail } from '@/lib/email/send'
import { renderInviteEmail } from '@/lib/email/templates'
import { hashPasswordSsha } from '@/lib/ldap/password'
import {
  createSyncEvent,
  dispatchDiscourseSyncAfterCommit,
  dispatchLdapSyncAfterCommit,
} from '@/lib/sync/create-sync-event'
import { actionClient, groupAdminAction } from './client'
import { addUserToGroupAdmin } from './group-actions'

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
    await sendEmail({
      to: parsedInput.email,
      subject,
      html,
    })

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
    return { invite, emailSent: true }
  })

export async function getInvites() {
  const session = await requireGroupAdmin()
  const managedGroupIds = session.ownerships.map((o) => o.groupId)
  return prisma.invite.findMany({
    where: session.isAdmin
      ? undefined
      : {
          OR: [
            { memberGroups: { some: { groupId: { in: managedGroupIds } } } },
            { ownerGroups: { some: { groupId: { in: managedGroupIds } } } },
          ],
        },
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
    await sendEmail({
      to: invite.email,
      subject,
      html,
    })

    revalidatePath('/invites')
    return { success: true, emailSent: true }
  })

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .regex(/^[^"(),=`<>]{2,}[^"(),=`<> ]+$/, 'Name must not contain "(),=<>'),
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

    const { user, ldapSyncEventId, groupSyncEventIds, discourseSyncEventId } =
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

        if (effectiveMemberGroupIds.length > 0) {
          await tx.groupMembership.createMany({
            data: effectiveMemberGroupIds.map((groupId) => ({
              userId: newUser.id,
              groupId,
            })),
          })
        }

        if (invite.ownerGroups.length > 0) {
          await tx.groupOwnership.createMany({
            data: invite.ownerGroups.map((og) => ({
              userId: newUser.id,
              groupId: og.groupId,
            })),
          })
          await addUserToGroupAdmin(tx, newUser.id)
        }

        const ldapEv = await createSyncEvent(tx, {
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
        await tx.invite.delete({ where: { id: invite.id } })

        return {
          user: newUser,
          ldapSyncEventId: ldapEv.id,
          groupSyncEventIds,
          discourseSyncEventId: discourseUserEv.id,
        }
      })

    await dispatchLdapSyncAfterCommit(ldapSyncEventId, 'LDAP')
    for (const id of groupSyncEventIds) {
      await dispatchLdapSyncAfterCommit(id, 'LDAP')
    }
    await dispatchDiscourseSyncAfterCommit(discourseSyncEventId, 'DISCOURSE')

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
