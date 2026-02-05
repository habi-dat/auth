import type { PrismaClient } from '@habidat/db'
import type { SyncTarget } from '@habidat/db'
import { queueDiscourseSync, queueLdapSync } from '@habidat/sync'

export type SyncEventPayload =
  | { userId: string; hashedPassword?: string }
  | { groupId: string; oldSlug?: string }
  | { groupId: string; discourseId?: number; slug: string; oldSlug?: string }
  | { ldapDn: string; username: string }
  | { ldapDn: string; slug: string }
  | { username: string }

export interface CreateSyncEventParams {
  target: SyncTarget
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC_GROUPS'
  entityType: 'USER' | 'GROUP'
  entityId: string
  payload: SyncEventPayload
}

type Transaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export interface CreatedSyncEvent {
  id: string
}

/**
 * Inserts a SyncEvent into the outbox (use inside a transaction).
 * Returns the created event so the caller can queue the job after commit.
 */
export async function createSyncEvent(
  tx: Transaction,
  params: CreateSyncEventParams
): Promise<CreatedSyncEvent> {
  const event = await tx.syncEvent.create({
    data: {
      target: params.target,
      operation: params.operation,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload as object,
      status: 'PENDING',
    },
  })
  return { id: event.id }
}

/**
 * Call after the transaction has committed to dispatch the LDAP sync job.
 * Only queues when target is LDAP.
 */
export async function dispatchLdapSyncAfterCommit(syncEventId: string, target: SyncTarget): Promise<void> {
  if (target === 'LDAP') {
    await queueLdapSync(syncEventId)
  }
}

/**
 * Call after the transaction has committed to dispatch the Discourse sync job.
 * Only queues when target is DISCOURSE.
 */
export async function dispatchDiscourseSyncAfterCommit(
  syncEventId: string,
  target: SyncTarget
): Promise<void> {
  if (target === 'DISCOURSE') {
    await queueDiscourseSync(syncEventId)
  }
}
