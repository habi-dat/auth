import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const webEnv = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    APP_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    BETTER_AUTH_SECRET: z.string().min(32),
    SAML_PRIVATE_KEY: z.string().optional(),
    SAML_CERTIFICATE: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    APP_URL: process.env.APP_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    SAML_PRIVATE_KEY: process.env.SAML_PRIVATE_KEY,
    SAML_CERTIFICATE: process.env.SAML_CERTIFICATE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
})

export type WebEnv = typeof webEnv
