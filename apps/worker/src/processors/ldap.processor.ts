import type { PrismaClient } from '@habidat/db'
import type { LdapService } from '@habidat/ldap'
import type { JOB_NAMES, LdapSyncJobData } from '@habidat/sync'
import type { Job } from 'bullmq'

export function createLdapProcessor(
  ldap: LdapService,
  prisma: PrismaClient
): (job: Job<LdapSyncJobData, void, typeof JOB_NAMES.LDAP_SYNC>) => Promise<void> {
  return async (job: Job<LdapSyncJobData, void, typeof JOB_NAMES.LDAP_SYNC>) => {
    const { syncEventId } = job.data
    const event = await prisma.syncEvent.findUniqueOrThrow({
      where: { id: syncEventId },
    })

    if (event.target !== 'LDAP') {
      return
    }

    console.log(`[LDAP] Processing syncEvent ${syncEventId} ${event.entityType} ${event.operation}`)

    await prisma.syncEvent.update({
      where: { id: syncEventId },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    })

    try {
      if (event.entityType === 'USER') {
        if (event.operation === 'DELETE') {
          await handleDeleteUser(ldap, event.payload as { ldapDn: string; username: string })
        } else {
          await handleSyncUser(
            ldap,
            prisma,
            event.payload as { userId: string; hashedPassword?: string }
          )
        }
      } else if (event.entityType === 'GROUP') {
        if (event.operation === 'DELETE') {
          await handleDeleteGroup(ldap, event.payload as { ldapDn: string; slug: string })
        } else {
          await handleSyncGroup(ldap, prisma, event.payload as { groupId: string })
        }
      }

      await prisma.syncEvent.update({
        where: { id: syncEventId },
        data: { status: 'COMPLETED', processedAt: new Date(), lastError: null },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : err != null ? String(err) : 'unknown'
      console.error(`[LDAP] syncEvent ${syncEventId} failed:`, message)
      if (err instanceof Error && err.stack) console.error(err.stack)
      await prisma.syncEvent.update({
        where: { id: syncEventId },
        data: {
          status: event.attempts + 1 >= event.maxAttempts ? 'FAILED' : 'RETRYING',
          lastError: message,
        },
      })
      throw err instanceof Error ? err : new Error(message)
    }
  }
}

/** Call ldap.createUser; on NoSuchObjectError throw a clear message (parent OU missing). */
async function createUserOrThrow(
  ldap: LdapService,
  user: {
    username: string
    name: string
    email: string
    location: string | null
    preferredLanguage: string
    storageQuota: string
    ldapUidNumber: number
    primaryGroupName?: string | null
    primaryGroupLdapDn?: string | null
  },
  userPassword?: string
): Promise<string> {
  try {
    return await ldap.createUser({
      username: user.username,
      name: user.name,
      email: user.email,
      location: user.location ?? undefined,
      preferredLanguage: user.preferredLanguage,
      storageQuota: user.storageQuota ?? '1 GB',
      ldapUidNumber: user.ldapUidNumber,
      ...(user.primaryGroupName ? { title: user.primaryGroupName } : {}),
      ...(user.primaryGroupLdapDn ? { ou: user.primaryGroupLdapDn } : {}),
      ...(userPassword ? { userPassword } : {}),
    })
  } catch (err) {
    if (isNoSuchObjectError(err)) {
      const usersDn = ldap.getUsersDn()
      throw new Error(
        `LDAP users container does not exist. Create this OU on the server first: ${usersDn}\n` +
          `Example LDIF:\n  dn: ${usersDn}\n  objectClass: organizationalUnit\n  ou: <ou-value>\n` +
          `Load with: ldapadd -x -D "your-admin-dn" -W -f users-ou.ldif`
      )
    }
    throw err
  }
}

/** Sync user: fetch from DB and LDAP, compare, create or update in LDAP. */
async function handleSyncUser(
  ldap: LdapService,
  prisma: PrismaClient,
  payload: { userId: string; hashedPassword?: string }
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: payload.userId },
    include: { primaryGroup: { select: { name: true, ldapDn: true } } },
  })

  if (!user.ldapUidNumber) {
    const maxUid = await prisma.user.aggregate({
      _max: { ldapUidNumber: true },
    })
    const ldapUidNumber = (maxUid._max.ldapUidNumber ?? 10000) + 1
    await prisma.user.update({
      where: { id: user.id },
      data: { ldapUidNumber },
    })
    user.ldapUidNumber = ldapUidNumber
  }

  const ldapUser = user.ldapDn
    ? await ldap.findUserByDn(user.ldapDn)
    : await ldap.findUserByUsername(user.username)
  const userPassword = payload.hashedPassword

  if (!ldapUser) {
    const dn = await createUserOrThrow(
      ldap,
      {
        ...user,
        ldapUidNumber: user.ldapUidNumber!,
        primaryGroupName: user.primaryGroup?.name ?? null,
        primaryGroupLdapDn: user.primaryGroup?.ldapDn ?? null,
      },
      userPassword
    )
    await prisma.user.update({
      where: { id: user.id },
      data: { ldapDn: dn, ldapSynced: true, ldapSyncedAt: new Date() },
    })
    return
  }

  const primaryGroupName = user.primaryGroup?.name ?? ''
  const primaryGroupLdapDn = user.primaryGroup?.ldapDn ?? ''
  const needsUpdate =
    ldapUser.cn !== user.name ||
    ldapUser.mail !== user.email ||
    (ldapUser.l ?? '') !== (user.location ?? '') ||
    (ldapUser.preferredLanguage ?? 'de') !== (user.preferredLanguage ?? 'de') ||
    (ldapUser.description ?? '1 GB') !== (user.storageQuota ?? '1 GB') ||
    (ldapUser.title ?? '') !== primaryGroupName ||
    (ldapUser.ou ?? '') !== primaryGroupLdapDn ||
    (userPassword != null && ldapUser.userPassword !== userPassword)

  if (needsUpdate) {
    try {
      await ldap.updateUser(ldapUser.dn, {
        name: user.name,
        email: user.email,
        ...(user.location && user.location !== '' ? { location: user.location } : {}),
        preferredLanguage: user.preferredLanguage,
        storageQuota: user.storageQuota ?? undefined,
        ...(primaryGroupName && primaryGroupName !== '' ? { title: primaryGroupName } : {}),
        ...(primaryGroupLdapDn && primaryGroupLdapDn !== '' ? { ou: primaryGroupLdapDn } : {}),
        ...(userPassword ? { userPassword } : {}),
      })
    } catch (updateErr) {
      if (isNoSuchObjectError(updateErr)) {
        const dn = await createUserOrThrow(
          ldap,
          {
            ...user,
            ldapUidNumber: user.ldapUidNumber!,
            primaryGroupName: user.primaryGroup?.name ?? null,
            primaryGroupLdapDn: user.primaryGroup?.ldapDn ?? null,
          },
          userPassword
        )
        await prisma.user.update({
          where: { id: user.id },
          data: { ldapDn: dn, ldapSynced: true, ldapSyncedAt: new Date() },
        })
        return
      }
      throw updateErr
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ldapDn: ldapUser.dn,
      ldapSynced: true,
      ldapSyncedAt: new Date(),
    },
  })
}

function isNoSuchObjectError(err: unknown): boolean {
  if (err == null) return false
  const e = err as { name?: string; code?: number }
  return e.name === 'NoSuchObjectError' || e.code === 32
}

async function handleDeleteUser(
  ldap: LdapService,
  payload: { ldapDn: string; username: string }
): Promise<void> {
  if (!payload.ldapDn) return
  await ldap.deleteUser(payload.ldapDn)
}

/** Sync group: ensure member users and child groups exist in LDAP, then create or update group. */
async function handleSyncGroup(
  ldap: LdapService,
  prisma: PrismaClient,
  payload: { groupId: string }
): Promise<void> {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: payload.groupId },
    include: {
      memberships: { include: { user: true } },
      childGroups: { include: { childGroup: true } },
    },
  })

  const memberDns: string[] = []

  for (const m of group.memberships) {
    const userDn = m.user.ldapDn
    if (userDn) {
      memberDns.push(userDn)
    } else {
      await handleSyncUser(ldap, prisma, { userId: m.user.id })
      const u = await prisma.user.findUniqueOrThrow({
        where: { id: m.user.id },
        select: { ldapDn: true },
      })
      if (u.ldapDn) memberDns.push(u.ldapDn)
    }
  }

  for (const h of group.childGroups) {
    const child = h.childGroup
    if (!child.ldapDn) {
      await handleSyncGroup(ldap, prisma, { groupId: child.id })
      const g = await prisma.group.findUniqueOrThrow({
        where: { id: child.id },
        select: { ldapDn: true },
      })
      if (g.ldapDn) memberDns.push(g.ldapDn)
    } else {
      memberDns.push(child.ldapDn)
    }
  }

  const ldapGroup = await ldap.findGroupBySlug(group.slug)

  if (!ldapGroup) {
    let dn: string
    try {
      dn = await ldap.createGroup({
        slug: group.slug,
        name: group.name,
        description: group.description,
        memberDns,
      })
    } catch (err) {
      if (isNoSuchObjectError(err)) {
        const groupsDn = ldap.getGroupsDn()
        throw new Error(
          `LDAP groups container does not exist. Create this OU on the server first: ${groupsDn}\n` +
            `Example LDIF:\n  dn: ${groupsDn}\n  objectClass: organizationalUnit\n  ou: <ou-value>\n` +
            `Load with: ldapadd -x -D "your-admin-dn" -W -f groups-ou.ldif`
        )
      }
      throw err
    }
    await prisma.group.update({
      where: { id: group.id },
      data: { ldapDn: dn, ldapSynced: true, ldapSyncedAt: new Date() },
    })
    return
  }

  const currentMembers = new Set(ldapGroup.member ?? [])
  const desiredMembers = new Set(memberDns)
  const needsUpdate =
    ldapGroup.o !== group.name ||
    (ldapGroup.description ?? '') !== group.description ||
    currentMembers.size !== desiredMembers.size ||
    [...desiredMembers].some((d) => !currentMembers.has(d))

  if (needsUpdate) {
    await ldap.updateGroup(ldapGroup.dn, {
      name: group.name,
      description: group.description,
      memberDns,
    })
  }

  await prisma.group.update({
    where: { id: group.id },
    data: {
      ldapDn: ldapGroup.dn,
      ldapSynced: true,
      ldapSyncedAt: new Date(),
    },
  })
}

async function handleDeleteGroup(
  ldap: LdapService,
  payload: { ldapDn: string; slug: string }
): Promise<void> {
  if (!payload.ldapDn) return
  await ldap.deleteGroup(payload.ldapDn)
}
