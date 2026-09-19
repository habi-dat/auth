import { prisma } from '@habidat/db'
import { webEnv } from '@habidat/env/web'
import { verifyPasswordSsha } from '@habidat/ldap'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
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

export type SyncLdapPasswordParams = {
  userId: string
  password: string
}

export type CreateAuthOverrides = {
  sendResetPassword?: (params: SendResetPasswordParams) => Promise<void>
  /** Enqueue an LDAP USER UPDATE with an SSHA hash of the new password. */
  syncLdapPassword?: (params: SyncLdapPasswordParams) => Promise<void>
}

const PASSWORD_SYNC_PATHS = new Set(['/change-password', '/reset-password'])

function readPasswordSyncBody(body: unknown): { newPassword?: string; token?: string } {
  if (!body || typeof body !== 'object') return {}
  const record = body as Record<string, unknown>
  return {
    newPassword: typeof record.newPassword === 'string' ? record.newPassword : undefined,
    token: typeof record.token === 'string' ? record.token : undefined,
  }
}

function sessionUserId(session: unknown): string | undefined {
  if (!session || typeof session !== 'object' || !('user' in session)) return undefined
  const user = (session as { user?: { id?: unknown } }).user
  return typeof user?.id === 'string' ? user.id : undefined
}

export function createAuth(overrides: CreateAuthOverrides = {}) {
  const syncLdapPassword = overrides.syncLdapPassword
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
      // Users are created by admins or invite accept, not public /sign-up/email.
      disableSignUp: true,
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
    ...(syncLdapPassword
      ? {
          hooks: {
            before: createAuthMiddleware(async (ctx) => {
              if (ctx.path !== '/reset-password') return
              const { token } = readPasswordSyncBody(ctx.body)
              if (!token) return
              const verification = await ctx.context.internalAdapter.findVerificationValue(
                `reset-password:${token}`
              )
              if (!verification || verification.expiresAt < new Date()) return
              return { context: { ldapPasswordSyncUserId: verification.value } }
            }),
            after: createAuthMiddleware(async (ctx) => {
              if (!PASSWORD_SYNC_PATHS.has(ctx.path)) return
              if (ctx.context.returned instanceof APIError) return
              const { newPassword } = readPasswordSyncBody(ctx.body)
              if (!newPassword) return

              const userId =
                ctx.path === '/change-password'
                  ? sessionUserId(ctx.context.session)
                  : (ctx as { ldapPasswordSyncUserId?: string }).ldapPasswordSyncUserId
              if (!userId) return

              try {
                await syncLdapPassword({ userId, password: newPassword })
              } catch (err) {
                console.error('[Auth] Failed to enqueue LDAP password sync for user', userId, err)
              }
            }),
          },
        }
      : {}),
  })
}

export const auth = createAuth()

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
