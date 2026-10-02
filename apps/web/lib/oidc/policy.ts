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
