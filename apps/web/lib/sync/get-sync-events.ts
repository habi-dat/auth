import type { SyncStatus, SyncTarget } from '@habidat/db'
import { prisma } from '@habidat/db'

export interface GetSyncEventsParams {
  target?: SyncTarget
  status?: SyncStatus
  limit?: number
}

export type SyncEventWithEntityName = Awaited<
  ReturnType<typeof prisma.syncEvent.findMany>
>[number] & { entityName: string }

export async function getSyncEvents(
  params: GetSyncEventsParams = {}
): Promise<SyncEventWithEntityName[]> {
  const { target, status, limit = 100 } = params

  const events = await prisma.syncEvent.findMany({
    where: {
      ...(target != null && { target }),
      ...(status != null && { status }),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 500),
  })

  const userIds = [
    ...new Set(
      events.filter((e) => e.entityType === 'USER').map((e) => e.entityId)
    ),
  ]
  const groupIds = [
    ...new Set(
      events.filter((e) => e.entityType === 'GROUP').map((e) => e.entityId)
    ),
  ]

  const [users, groups] = await Promise.all([
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [],
    groupIds.length > 0
      ? prisma.group.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, name: true },
        })
      : [],
  ])

  const userNamesById = new Map(users.map((u) => [u.id, u.name]))
  const groupNamesById = new Map(groups.map((g) => [g.id, g.name]))

  return events.map((event) => {
    let entityName = event.entityId
    if (event.entityType === 'USER') {
      entityName = userNamesById.get(event.entityId) ?? event.entityId
    } else if (event.entityType === 'GROUP') {
      entityName = groupNamesById.get(event.entityId) ?? event.entityId
    }
    return { ...event, entityName }
  })
}
