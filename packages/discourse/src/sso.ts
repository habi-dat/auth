import { createHmac, timingSafeEqual } from 'node:crypto'

/** Discourse HMAC-SHA256, hex-encoded (DiscourseConnect). */
export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Restore `+` that `URLSearchParams` decoded as spaces, then verify the HMAC
 * in constant time. Returns the canonical payload when valid.
 */
export function verifyDiscourseSsoPayload(secret: string, sso: string, sig: string): string | null {
  const payload = sso.replace(/ /g, '+')
  const expected = hmacSha256Hex(secret, payload)
  const provided = sig.trim().toLowerCase()
  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(provided, 'utf8')
  if (expectedBuf.length !== providedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf)
    return null
  }
  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return null
  }
  return payload
}

export type DiscourseReturnUrlAllowlist = {
  discourseUrl?: string
  appUrl?: string
  trustedOrigins?: string
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function parentDomain(hostname: string): string | null {
  const parts = hostname.split('.')
  if (parts.length < 3) return null
  return parts.slice(1).join('.')
}

/** Parse `https://*.example.com` / `https://example.com` entries from TRUSTED_ORIGINS. */
function parseOriginPattern(origin: string): { hostname: string; wildcard: boolean } | null {
  const match = origin.trim().match(/^(https?):\/\/(\*\.)?([^/:]+)/i)
  if (!match) return null
  return { wildcard: Boolean(match[2]), hostname: match[3].toLowerCase() }
}

function hostIsAllowed(
  hostname: string,
  exactHosts: Set<string>,
  wildcardSuffixes: Set<string>
): boolean {
  if (exactHosts.has(hostname)) return true
  for (const suffix of wildcardSuffixes) {
    if (hostname === suffix || hostname.endsWith(`.${suffix}`)) return true
  }
  return false
}

/** Browser-reachable Discourse origin; skips Docker service names like `discourse`. */
export function publicDiscourseOrigin(discourseUrl?: string): string | null {
  if (!discourseUrl) return null
  try {
    const parsed = new URL(discourseUrl)
    if (!parsed.hostname.includes('.')) return null
    return parsed.origin
  } catch {
    return null
  }
}

function collectAllowedHosts(
  allowlist: DiscourseReturnUrlAllowlist,
  includeDiscourseUrl: boolean
): { exactHosts: Set<string>; wildcardSuffixes: Set<string> } {
  const exactHosts = new Set<string>()
  const wildcardSuffixes = new Set<string>()

  if (includeDiscourseUrl) {
    const discourseHost = allowlist.discourseUrl ? hostnameOf(allowlist.discourseUrl) : null
    if (discourseHost) exactHosts.add(discourseHost)
  }

  const appHost = allowlist.appUrl ? hostnameOf(allowlist.appUrl) : null
  if (appHost) {
    exactHosts.add(appHost)
    const parent = parentDomain(appHost)
    if (parent) wildcardSuffixes.add(parent)
  }

  if (allowlist.trustedOrigins) {
    for (const part of allowlist.trustedOrigins.split(',')) {
      const origin = parseOriginPattern(part)
      if (!origin) continue
      if (origin.wildcard) wildcardSuffixes.add(origin.hostname)
      else exactHosts.add(origin.hostname)
    }
  }

  return { exactHosts, wildcardSuffixes }
}

function parseAllowedHttpUrl(
  value: string,
  allowlist: DiscourseReturnUrlAllowlist,
  includeDiscourseUrl: boolean
): URL | null {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (parsed.username || parsed.password) return null

  const { exactHosts, wildcardSuffixes } = collectAllowedHosts(allowlist, includeDiscourseUrl)
  if (exactHosts.size === 0 && wildcardSuffixes.size === 0) return null
  if (!hostIsAllowed(parsed.hostname.toLowerCase(), exactHosts, wildcardSuffixes)) return null

  return parsed
}

/** True when `origin` is APP_URL, a sibling of APP_URL's parent domain, or TRUSTED_ORIGINS. */
export function isAllowedBrowserOrigin(
  origin: string,
  allowlist: DiscourseReturnUrlAllowlist
): boolean {
  return parseAllowedHttpUrl(origin, allowlist, false) !== null
}

/**
 * DiscourseConnect `return_sso_url` must be http(s), have no credentials,
 * land on `/session/sso_login`, and use a host we already trust (Discourse
 * base URL, the auth app's parent domain, or TRUSTED_ORIGINS).
 */
export function parseAllowedDiscourseReturnUrl(
  returnSsoUrl: string,
  allowlist: DiscourseReturnUrlAllowlist
): URL | null {
  const parsed = parseAllowedHttpUrl(returnSsoUrl, allowlist, true)
  if (!parsed) return null
  if (!parsed.pathname.endsWith('/session/sso_login')) return null
  return parsed
}

/**
 * Post-logout redirect (Discourse `logout_redirect` return). Same hosts as SSO,
 * but any path, and Docker-internal DISCOURSE_URL hosts are not treated as
 * browser destinations.
 */
export function parseAllowedLogoutReturnUrl(
  returnTo: string,
  allowlist: DiscourseReturnUrlAllowlist
): URL | null {
  const includeDiscourseUrl = Boolean(publicDiscourseOrigin(allowlist.discourseUrl))
  return parseAllowedHttpUrl(returnTo, allowlist, includeDiscourseUrl)
}
