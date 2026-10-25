/** Authorization code only. Refresh tokens are not issued. */
export const OIDC_GRANT_TYPES = ['authorization_code'] as const

const FRESH_PASSWORD_REASONS = new Set(['login_prompt', 'max_age'])

export function promptValues(prompt: unknown): Set<string> {
  if (typeof prompt !== 'string') return new Set()
  return new Set(prompt.split(/\s+/).filter(Boolean))
}

/**
 * prompt=login and max_age are the only reasons to ignore an existing SSO
 * session. A missing OIDC session (no_session) still reuses it.
 */
export function demandsFreshPassword(reasons: readonly string[] | undefined): boolean {
  return !!reasons?.some((reason) => FRESH_PASSWORD_REASONS.has(reason))
}

/**
 * True when the SSO session is not the one we saw when reauthentication was
 * demanded. A missing session at that moment counts once a later login exists.
 */
export function sessionIsFresh(input: {
  sessionId: string | null
  createdAt: Date | null
  markedSessionId: string | null | undefined
  markedAt: number | undefined
  skewMs?: number
}): boolean {
  if (!input.sessionId || input.markedAt === undefined) return false
  if (input.markedSessionId) return input.sessionId !== input.markedSessionId
  if (!input.createdAt) return false
  return input.createdAt.getTime() + (input.skewMs ?? 1000) >= input.markedAt
}

/**
 * oidc-provider keeps its own session cookie and answers an authorization
 * request from it without an interaction. That session outlives a logout from
 * habidat and does not see later changes to app access, so it may only be
 * reused while it still matches the habidat SSO session.
 *
 * True when the request must go through the interaction instead. A request
 * resumed from the interaction was checked there and passes.
 */
export function oidcSessionIsStale(input: {
  oidcAccountId: string | undefined
  resumedFromInteraction: boolean
  ssoUserId: string | null
  canUseApp: () => Promise<boolean>
}): Promise<boolean> | boolean {
  if (!input.oidcAccountId || input.resumedFromInteraction) return false
  if (!input.ssoUserId || input.ssoUserId !== input.oidcAccountId) return true
  return input.canUseApp().then((allowed) => !allowed)
}
