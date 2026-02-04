import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const sharedEnv = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

export type SharedEnv = typeof sharedEnv
