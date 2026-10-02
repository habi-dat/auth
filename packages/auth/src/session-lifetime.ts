/** Request header set by the login form when "Angemeldet bleiben" is checked. */
export const STAY_LOGGED_IN_HEADER = 'x-habidat-stay-logged-in'

/** This browser's saved checkbox choice. Absent or any other value means unchecked. */
export const STAY_LOGGED_IN_STORAGE_KEY = 'habidat.stayLoggedIn'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** Ordinary SSO session: unused time before it ends. */
export const ORDINARY_IDLE_MS = 12 * HOUR_MS

/** Ordinary SSO session: longest it may last after login. */
export const ORDINARY_ABSOLUTE_MS = 24 * HOUR_MS

/** Persistent SSO session: fixed length from login. Idle and absolute are the same. */
export const PERSISTENT_LIFETIME_MS = 30 * DAY_MS

/**
 * Better Auth has one global `expiresIn`. It has to be the longest lifetime so a
 * persistent cookie is not capped at the ordinary window. Real expiry is applied
 * per session and the built-in refresh is disabled.
 */
export const SESSION_EXPIRES_IN_SECONDS = PERSISTENT_LIFETIME_MS / 1000

/** Skip a write when the new end is within this much of the stored end. */
export const SESSION_REFRESH_SLACK_MS = HOUR_MS

export function requestHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== 'object') return null
  if ('get' in headers && typeof headers.get === 'function') {
    const value = headers.get(name)
    return typeof value === 'string' ? value : null
  }
  try {
    return new Headers(headers as never).get(name)
  } catch {
    return null
  }
}

export function stayLoggedInFromHeader(value: string | null | undefined): boolean {
  return value === '1'
}

/** `null` means a legacy row that must keep its stored expiry. */
export function readStayLoggedIn(value: unknown): boolean | null {
  if (value === true || value === false) return value
  return null
}

export function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

export function sessionExpiresAt(input: {
  createdAt: Date
  now: Date
  stayLoggedIn: boolean
}): Date {
  if (input.stayLoggedIn) {
    return new Date(input.createdAt.getTime() + PERSISTENT_LIFETIME_MS)
  }
  const idleDeadline = input.now.getTime() + ORDINARY_IDLE_MS
  const absoluteDeadline = input.createdAt.getTime() + ORDINARY_ABSOLUTE_MS
  return new Date(Math.min(idleDeadline, absoluteDeadline))
}

export function shouldRefreshSessionExpiry(currentExpiresAt: Date, nextExpiresAt: Date): boolean {
  return nextExpiresAt.getTime() - currentExpiresAt.getTime() > SESSION_REFRESH_SLACK_MS
}

export function sessionCookieMaxAgeSeconds(expiresAt: Date, now = new Date()): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
}
