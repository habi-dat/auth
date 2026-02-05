import type { SyncStatus, SyncTarget } from '@habidat/db'
import { prisma } from '@habidat/db'

export interface GetSyncEventsParams {
  target?: SyncTarget
  status?: SyncStatus
  limit?: number
}

export async function getSyncEvents(params: GetSyncEventsParams = {}) {
  const { target, status, limit = 100 } = params

  return prisma.syncEvent.findMany({
    where: {
      ...(target != null && { target }),
      ...(status != null && { status }),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 500),
  })
}
