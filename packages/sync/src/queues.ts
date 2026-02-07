import { Queue } from 'bullmq'
import { defaultJobOptions, JOB_NAMES, QUEUE_NAMES } from './constants'
import { getRedisConnection } from './connection'

export interface LdapSyncJobData {
  syncEventId: string
}

export interface DiscourseSyncJobData {
  syncEventId: string
}

let ldapQueue: Queue<LdapSyncJobData, void, typeof JOB_NAMES.LDAP_SYNC> | null = null
let discourseQueue: Queue<DiscourseSyncJobData, void, typeof JOB_NAMES.DISCOURSE_SYNC> | null = null

export function getLdapQueue(
  redisUrl?: string
): Queue<LdapSyncJobData, void, typeof JOB_NAMES.LDAP_SYNC> {
  if (!ldapQueue) {
    ldapQueue = new Queue(QUEUE_NAMES.LDAP_SYNC, {
      connection: getRedisConnection(redisUrl),
      defaultJobOptions,
    })
  }
  return ldapQueue
}

export function getDiscourseQueue(
  redisUrl?: string
): Queue<DiscourseSyncJobData, void, typeof JOB_NAMES.DISCOURSE_SYNC> {
  if (!discourseQueue) {
    discourseQueue = new Queue(QUEUE_NAMES.DISCOURSE_SYNC, {
      connection: getRedisConnection(redisUrl),
      defaultJobOptions,
    })
  }
  return discourseQueue
}

export async function queueLdapSync(syncEventId: string, redisUrl?: string): Promise<void> {
  const queue = getLdapQueue(redisUrl)
  await queue.add(JOB_NAMES.LDAP_SYNC, { syncEventId })
}

export async function queueDiscourseSync(syncEventId: string, redisUrl?: string): Promise<void> {
  const queue = getDiscourseQueue(redisUrl)
  await queue.add(JOB_NAMES.DISCOURSE_SYNC, { syncEventId })
}

export async function closeQueues(): Promise<void> {
  if (ldapQueue) {
    await ldapQueue.close()
    ldapQueue = null
  }
  if (discourseQueue) {
    await discourseQueue.close()
    discourseQueue = null
  }
}
