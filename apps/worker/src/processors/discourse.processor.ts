import type { PrismaClient } from '@habidat/db'
import type { DiscourseService } from '@habidat/discourse'
import type { DiscourseSyncJobData, JOB_NAMES } from '@habidat/sync'
import type { Job } from 'bullmq'

export function createDiscourseProcessor(
  discourse: DiscourseService,
  prisma: PrismaClient
): (job: Job<DiscourseSyncJobData, void, typeof JOB_NAMES.DISCOURSE_SYNC>) => Promise<void> {
  return async (job) => {
    const { syncEventId } = job.data
    const event = await prisma.syncEvent.findUniqueOrThrow({
      where: { id: syncEventId },
    })

    if (event.target !== 'DISCOURSE') {
      return
    }

    console.log(
      `[Discourse] Processing syncEvent ${syncEventId} ${event.entityType} ${event.operation}`
    )

    await prisma.syncEvent.update({
      where: { id: syncEventId },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    })

    try {
      if (event.entityType === 'USER') {
        if (event.operation === 'DELETE') {
          await handleDeleteUser(discourse, event.payload as { username: string })
        } else {
          await handleSyncUser(discourse, prisma, event.payload as { userId: string })
        }
      } else if (event.entityType === 'GROUP') {
        if (event.operation === 'DELETE') {
          await handleDeleteGroup(
            discourse,
            prisma,
            event.payload as {
              groupId: string
              discourseId?: number
              slug: string
              oldSlug?: string
            }
          )
        } else {
          await handleSyncGroup(
            discourse,
            prisma,
            event.payload as { groupId: string; oldSlug?: string }
          )
        }
      }

      await prisma.syncEvent.update({
        where: { id: syncEventId },
        data: { status: 'COMPLETED', processedAt: new Date(), lastError: null },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : err != null ? String(err) : 'unknown'
      console.error(`[Discourse] syncEvent ${syncEventId} failed:`, message)
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

/**
 * Resolve group slugs for sync_sso: direct membership groups + all parent (ancestor) groups
 * so that Discourse sees the user in every group they belong to (including parent groups).
 */
async function getGroupSlugsForUser(prisma: PrismaClient, userId: string): Promise<string[]> {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const slugs = new Set<string>()
  for (const m of memberships) {
    const groupSlugs = await getGroupSlugAndAncestorSlugs(prisma, m.groupId)
    for (const s of groupSlugs) slugs.add(s)
  }
  return [...slugs]
}

async function getGroupSlugAndAncestorSlugs(
  prisma: PrismaClient,
  groupId: string,
  visited = new Set<string>()
): Promise<string[]> {
  if (visited.has(groupId)) return []
  visited.add(groupId)
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { slug: true },
  })
  const result: string[] = [group.slug]
  const parents = await prisma.groupHierarchy.findMany({
    where: { childGroupId: groupId },
    select: { parentGroupId: true },
  })
  for (const p of parents) {
    const ancestorSlugs = await getGroupSlugAndAncestorSlugs(prisma, p.parentGroupId, visited)
    for (const s of ancestorSlugs) result.push(s)
  }
  return result
}

async function handleSyncUser(
  discourse: DiscourseService,
  prisma: PrismaClient,
  payload: { userId: string }
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: payload.userId },
    include: {
      primaryGroup: { select: { name: true } },
    },
  })

  // Ensure user is unsuspended in case they were previously logically deleted
  await discourse.unsuspendUser(user.username)

  const groupSlugs = await getGroupSlugsForUser(prisma, user.id)
  const externalId = user.discourseId ?? user.username
  await discourse.syncUserViaSso({
    externalId,
    email: user.email,
    username: user.username,
    name: user.name,
    title: user.primaryGroup?.name ?? undefined,
    groups: groupSlugs.length > 0 ? groupSlugs : undefined,
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      discourseId: user.discourseId ?? user.username,
      discourseSynced: true,
      discourseSyncedAt: new Date(),
    },
  })
}

async function handleDeleteUser(
  discourse: DiscourseService,
  payload: { username: string }
): Promise<void> {
  const result = await discourse.deleteUser(payload.username)
  if (result.notFound) {
    console.log(`[Discourse] User ${payload.username} not found for deletion`)
  } else if (result.suspended) {
    console.log(`[Discourse] User ${payload.username} has posts, suspended instead of deleted`)
  } else if (result.deleted) {
    console.log(`[Discourse] User ${payload.username} successfully deleted`)
  }
}

async function handleSyncGroup(
  discourse: DiscourseService,
  prisma: PrismaClient,
  payload: { groupId: string; oldSlug?: string }
): Promise<void> {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: payload.groupId },
  })

  if (!group.discourseId) {
    const lookupSlug = payload.oldSlug ?? group.slug
    const existingId = await discourse.getGroupBySlug(lookupSlug)
    const discourseId =
      existingId ??
      (await discourse.createGroup({
        slug: group.slug,
        name: group.name,
        description: group.description,
      }))
    await prisma.group.update({
      where: { id: group.id },
      data: {
        discourseId,
        discourseSynced: true,
        discourseSyncedAt: new Date(),
      },
    })
    if (existingId != null) {
      await discourse.updateGroup(discourseId, {
        slug: group.slug,
        name: group.name,
        description: group.description,
      })
    }
    return
  }

  await discourse.updateGroup(group.discourseId, {
    slug: group.slug,
    name: group.name,
    description: group.description,
  })
  await prisma.group.update({
    where: { id: group.id },
    data: { discourseSynced: true, discourseSyncedAt: new Date() },
  })
}

async function handleDeleteGroup(
  discourse: DiscourseService,
  _prisma: PrismaClient,
  payload: { groupId: string; discourseId?: number; slug: string; oldSlug?: string }
): Promise<void> {
  const lookupSlug = payload.oldSlug ?? payload.slug
  const discourseId = payload.discourseId ?? (await discourse.getGroupBySlug(lookupSlug))
  if (discourseId != null) {
    await discourse.deleteGroup(discourseId)
  }
}
