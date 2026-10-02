import { APIError, getShouldSkipSessionRefresh } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import {
  asDate,
  readStayLoggedIn,
  requestHeader,
  STAY_LOGGED_IN_HEADER,
  sessionCookieMaxAgeSeconds,
  sessionExpiresAt,
  shouldRefreshSessionExpiry,
  stayLoggedInFromHeader,
} from './session-lifetime'

type SessionBundle = Parameters<typeof setSessionCookie>[1]
type CookieContext = Parameters<typeof setSessionCookie>[0]

type LifetimeHookContext = {
  path: string
  context: {
    returned?: unknown
    newSession: SessionBundle | null
    session: SessionBundle | null
    internalAdapter: {
      updateSession: (
        sessionToken: string,
        session: { expiresAt: Date; updatedAt: Date }
      ) => Promise<(SessionBundle['session'] & Record<string, unknown>) | null>
    }
  }
}

export function sessionCreateData(
  createdAt: Date,
  headers: unknown
): { stayLoggedIn: boolean; expiresAt: Date } {
  const stayLoggedIn = stayLoggedInFromHeader(requestHeader(headers, STAY_LOGGED_IN_HEADER))
  return {
    stayLoggedIn,
    expiresAt: sessionExpiresAt({ createdAt, now: createdAt, stayLoggedIn }),
  }
}

/** The sign-in handler sets the cookie from the global 30-day expiresIn. Replace that with the real remaining lifetime. */
export async function alignSignInSessionCookie(ctx: LifetimeHookContext): Promise<void> {
  if (ctx.path !== '/sign-in/email') return
  if (ctx.context.returned instanceof APIError) return
  const created = ctx.context.newSession
  if (!created) return
  const expiresAt = asDate(created.session.expiresAt)
  if (!expiresAt) return
  await setSessionCookie(ctx as CookieContext, created, false, {
    maxAge: sessionCookieMaxAgeSeconds(expiresAt),
  })
}

/**
 * Extend an ordinary session's idle clock, capped by its absolute lifetime.
 * Legacy rows (stayLoggedIn null) are left alone. Persistent sessions do not move.
 * RSC reads skip this, matching Better Auth's Next.js cookie plugin.
 */
export async function refreshSessionLifetime(ctx: LifetimeHookContext): Promise<void> {
  if (ctx.path !== '/get-session') return
  if (await getShouldSkipSessionRefresh()) return
  const current = ctx.context.session
  if (!current?.session) return

  const stayLoggedIn = readStayLoggedIn(current.session.stayLoggedIn)
  if (stayLoggedIn === null) return

  const createdAt = asDate(current.session.createdAt)
  const expiresAt = asDate(current.session.expiresAt)
  if (!createdAt || !expiresAt) return

  const now = new Date()
  if (expiresAt.getTime() <= now.getTime()) return

  const nextExpiresAt = sessionExpiresAt({ createdAt, now, stayLoggedIn })
  if (!shouldRefreshSessionExpiry(expiresAt, nextExpiresAt)) return

  const updated = await ctx.context.internalAdapter.updateSession(current.session.token, {
    expiresAt: nextExpiresAt,
    updatedAt: now,
  })
  if (!updated) return

  await setSessionCookie(
    ctx as CookieContext,
    {
      session: { ...current.session, ...updated, expiresAt: nextExpiresAt },
      user: current.user,
    },
    false,
    { maxAge: sessionCookieMaxAgeSeconds(nextExpiresAt, now) }
  )
}
