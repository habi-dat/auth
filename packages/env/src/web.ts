import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const webEnv = createEnv({
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    APP_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    SAML_PRIVATE_KEY: z.string().optional(),
    SAML_CERTIFICATE: z.string().optional(),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number(),
    SMTP_SECURE: z
      .string()
      .transform((v) => v === 'true')
      .default('false'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().email(),
    // Discourse (for category management via API)
    DISCOURSE_URL: z.string().url().optional(),
    DISCOURSE_API_KEY: z.string().optional(),
    DISCOURSE_API_USERNAME: z.string().optional(),
    DISCOURSE_SSO_SECRET: z.string().optional(),
    TRUSTED_ORIGINS: z.string().optional(),
    TZ: z.string().default('Europe/Berlin'),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    APP_URL: process.env.APP_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    SAML_PRIVATE_KEY: process.env.SAML_PRIVATE_KEY,
    SAML_CERTIFICATE: process.env.SAML_CERTIFICATE,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    DISCOURSE_URL: process.env.DISCOURSE_URL,
    DISCOURSE_API_KEY: process.env.DISCOURSE_API_KEY,
    DISCOURSE_API_USERNAME: process.env.DISCOURSE_API_USERNAME,
    DISCOURSE_SSO_SECRET: process.env.DISCOURSE_SSO_SECRET,
    TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS,
    TZ: process.env.TZ,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
})

export type WebEnv = typeof webEnv
