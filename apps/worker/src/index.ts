import './load-env.js'
import { prisma } from '@habidat/db'
import { workerEnv } from '@habidat/env/worker'
import { LdapService } from '@habidat/ldap'
import {
  closeQueues,
  closeRedisConnection,
  getRedisConnection,
  QUEUE_NAMES,
} from '@habidat/sync'
import { Worker } from 'bullmq'
import { createLdapProcessor } from './processors/ldap.processor.js'

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
  {
    connection,
    concurrency: 5,
  }
)

async function main() {
  await ldapService.connect()
  console.log('✅ LDAP connected')
  console.log('✅ Workers started')
  console.log(`   - LDAP Sync: ${QUEUE_NAMES.LDAP_SYNC}`)
}

async function shutdown() {
  console.log('Shutting down...')
  await ldapWorker.close()
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
  console.error(`Job ${job?.id} failed:`, msg)
  if (stack) console.error(stack)
  if (err != null && typeof err === 'object' && !(err instanceof Error)) {
    console.error('Error payload:', JSON.stringify(err, null, 2))
  }
})

main().catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})
