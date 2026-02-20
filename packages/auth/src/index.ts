import { prisma } from '@habidat/db'
import { webEnv } from '@habidat/env/web'
import { verifyPasswordSsha } from '@habidat/ldap'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { nextCookies } from 'better-auth/next-js'

const baseURL = (
  process.env.APP_URL ||
  process.env.BETTER_AUTH_URL ||
  'http://localhost:3000'
).replace(/\/$/, '')

export type SendResetPasswordParams = {
  user: { id: string; email: string; name: string }
  url: string
  token: string
}

export type CreateAuthOverrides = {
  sendResetPassword?: (params: SendResetPasswordParams) => Promise<void>
}

export function createAuth(overrides: CreateAuthOverrides = {}) {
  return betterAuth({
    baseURL,
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    trustedOrigins: () => {
      const origins = [baseURL, 'http://localhost:3000']
      const envOrigins = webEnv.TRUSTED_ORIGINS
      if (envOrigins) {
        origins.push(...envOrigins.split(',').map((o) => o.trim()))
      }
      return origins
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      ...(overrides.sendResetPassword && { sendResetPassword: overrides.sendResetPassword }),
      password: {
        hash: async (password) => hashPassword(password),
        verify: async (data: { hash: string; password: string }) => {
          const { hash: hashedPassword, password: plainPassword } = data
          if (hashedPassword.startsWith('{SSHA}')) {
            return verifyPasswordSsha(hashedPassword, plainPassword)
          }
          return verifyPassword({ hash: hashedPassword, password: plainPassword })
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    user: {
      additionalFields: {
        username: { type: 'string', required: true, unique: true },
        location: { type: 'string', required: false },
        preferredLanguage: { type: 'string', required: false, defaultValue: 'de' },
        preferredTheme: { type: 'string', required: false },
        preferredColorMode: { type: 'string', required: false },
        storageQuota: { type: 'string', required: false, defaultValue: '1 GB' },
        primaryGroupId: { type: 'string', required: false },
        ldapDn: { type: 'string', required: false },
        ldapUidNumber: { type: 'number', required: false },
        ldapSynced: { type: 'boolean', required: false, defaultValue: false },
        ldapSyncedAt: { type: 'date', required: false },
      },
    },
    plugins: [nextCookies()],
  })
}

export const auth = createAuth()

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
