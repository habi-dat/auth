import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const workerEnv = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    // LDAP
    LDAP_URL: z.string().url(),
    LDAP_BIND_DN: z.string(),
    LDAP_BIND_PASSWORD: z.string(),
    LDAP_BASE_DN: z.string(),
    LDAP_USERS_DN: z.string(),
    LDAP_GROUPS_DN: z.string(),

    // Discourse
    DISCOURSE_URL: z.string().url().optional(),
    DISCOURSE_API_KEY: z.string().optional(),
    DISCOURSE_API_USERNAME: z.string().optional(),
    DISCOURSE_SSO_SECRET: z.string().optional(),

    // App
    APP_URL: z.string().url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

export type WorkerEnv = typeof workerEnv
