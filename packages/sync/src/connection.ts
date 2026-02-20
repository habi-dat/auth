import type { ConnectionOptions } from 'bullmq'

let connection: ConnectionOptions | null = null

export function getRedisConnection(url?: string): ConnectionOptions {
  const redisUrl = url ?? process.env.REDIS_URL
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for sync queues')
  }
  if (!connection) {
    connection = {
      host: new URL(redisUrl).hostname,
      port: Number(new URL(redisUrl).port) || 6379,
      password: new URL(redisUrl).password || undefined,
      username: new URL(redisUrl).username || undefined,
    }
  }
  return connection
}

export async function closeRedisConnection(): Promise<void> {
  connection = null
}
