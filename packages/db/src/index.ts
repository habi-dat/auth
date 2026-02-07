import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/client/client'

export * from '../generated/client/client'
// Re-export types from generated client
export { PrismaClient } from '../generated/client/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const pool = globalForPrisma.pool ?? new Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.pool = pool
  }

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
