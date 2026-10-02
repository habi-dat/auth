import type { AdapterPayload } from 'oidc-provider'

export type OidcStored = { payload: AdapterPayload; expiresAt?: number }

type OidcGlobal = typeof globalThis & {
  __habidatOidc?: Map<string, OidcStored>
  __habidatOidcSweep?: number
}

const SWEEP_INTERVAL_MS = 60_000
const REAUTH_TTL_MS = 10 * 60 * 1000

/** One map per process, including when the module is evaluated twice. */
export function oidcStorage(): Map<string, OidcStored> {
  const globalStore = globalThis as OidcGlobal
  if (!globalStore.__habidatOidc) globalStore.__habidatOidc = new Map()
  return globalStore.__habidatOidc
}

export function sweepExpiredOidc(now = Date.now()): void {
  const globalStore = globalThis as OidcGlobal
  if (globalStore.__habidatOidcSweep && now - globalStore.__habidatOidcSweep < SWEEP_INTERVAL_MS) {
    return
  }
  globalStore.__habidatOidcSweep = now
  for (const [key, entry] of oidcStorage()) {
    if (entry.expiresAt && entry.expiresAt <= now) oidcStorage().delete(key)
  }
}

export type OidcReauthMark = { markedAt: number; sessionId: string | null }

export function markOidcReauth(
  uid: string,
  sessionId: string | null,
  at = Date.now()
): OidcReauthMark {
  const mark = { markedAt: at, sessionId }
  oidcStorage().set(`reauth:${uid}`, {
    payload: mark as AdapterPayload,
    expiresAt: at + REAUTH_TTL_MS,
  })
  return mark
}

export function oidcReauthMark(uid: string, now = Date.now()): OidcReauthMark | undefined {
  const entry = oidcStorage().get(`reauth:${uid}`)
  if (!entry || (entry.expiresAt && entry.expiresAt <= now)) {
    if (entry) oidcStorage().delete(`reauth:${uid}`)
    return undefined
  }
  const payload = entry.payload as { markedAt?: unknown; sessionId?: unknown }
  if (typeof payload.markedAt !== 'number') return undefined
  return {
    markedAt: payload.markedAt,
    sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : null,
  }
}
