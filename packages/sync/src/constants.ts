export const QUEUE_NAMES = {
  LDAP_SYNC: 'ldap-sync',
  DISCOURSE_SYNC: 'discourse-sync',
} as const

/** Single job type per queue: worker loads SyncEvent by id and processes based on event target/operation/entityType */
export const JOB_NAMES = {
  LDAP_SYNC: 'ldap:sync',
  DISCOURSE_SYNC: 'discourse:sync',
} as const

export const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
}
