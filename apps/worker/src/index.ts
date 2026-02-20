import './load-env'
import { prisma } from '@habidat/db'
import { DiscourseService } from '@habidat/discourse'
import { workerEnv } from '@habidat/env/worker'
import { LdapService } from '@habidat/ldap'
import {
  closeQueues,
  closeRedisConnection,
  type DiscourseSyncJobData,
  getRedisConnection,
  QUEUE_NAMES,
} from '@habidat/sync'
import { Worker } from 'bullmq'
import { createDiscourseProcessor } from './processors/discourse.processor'
import { createLdapProcessor } from './processors/ldap.processor'

const env = workerEnv

const ldapService = new LdapService({
  url: env.LDAP_URL,
  bindDn: env.LDAP_BIND_DN,
  bindPassword: env.LDAP_BIND_PASSWORD,
  baseDn: env.LDAP_BASE_DN,
  usersDn: env.LDAP_USERS_DN,
  groupsDn: env.LDAP_GROUPS_DN,
})

const connection = getRedisConnection(env.REDIS_URL)

const ldapProcessor = createLdapProcessor(ldapService, prisma)
const ldapWorker = new Worker(
  QUEUE_NAMES.LDAP_SYNC,
  ldapProcessor as (job: Parameters<typeof ldapProcessor>[0]) => Promise<void>,
  { connection, concurrency: 5 }
)

const hasDiscourse =
  env.DISCOURSE_URL &&
  env.DISCOURSE_API_KEY &&
  env.DISCOURSE_API_USERNAME &&
  env.DISCOURSE_SSO_SECRET

let discourseWorker: Worker<DiscourseSyncJobData, void, 'discourse:sync'> | null = null
if (hasDiscourse) {
  const discourseService = new DiscourseService({
    url: env.DISCOURSE_URL!,
    apiKey: env.DISCOURSE_API_KEY!,
    apiUsername: env.DISCOURSE_API_USERNAME!,
    ssoSecret: env.DISCOURSE_SSO_SECRET!,
  })
  const discourseProcessor = createDiscourseProcessor(discourseService, prisma)
  const worker = new Worker(
    QUEUE_NAMES.DISCOURSE_SYNC,
    discourseProcessor as (job: Parameters<typeof discourseProcessor>[0]) => Promise<void>,
    { connection, concurrency: 5 }
  )
  discourseWorker = worker
  worker.on('failed', (job, err) => {
    const msg = err instanceof Error ? err.message : err != null ? String(err) : 'unknown'
    const stack = err instanceof Error ? err.stack : undefined
    console.error(`[Discourse] Job ${job?.id} failed:`, msg)
    if (stack) console.error(stack)
  })
}

async function main() {
  await ldapService.connect()
  console.log('✅ LDAP connected')
  console.log('✅ Workers started')
  console.log(`   - LDAP Sync: ${QUEUE_NAMES.LDAP_SYNC}`)
  if (hasDiscourse) console.log(`   - Discourse Sync: ${QUEUE_NAMES.DISCOURSE_SYNC}`)
}

async function shutdown() {
  console.log('Shutting down...')
  await ldapWorker.close()
  if (discourseWorker) await discourseWorker.close()
  await ldapService.disconnect()
  await closeQueues()
  await closeRedisConnection()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

ldapWorker.on('failed', (job, err) => {
  const msg = err instanceof Error ? err.message : err != null ? String(err) : 'unknown'
  const stack = err instanceof Error ? err.stack : undefined
  console.error(`[LDAP] Job ${job?.id} failed:`, msg)
  if (stack) console.error(stack)
  if (err != null && typeof err === 'object' && !(err instanceof Error)) {
    console.error('Error payload:', JSON.stringify(err, null, 2))
  }
})

main().catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})
