/** Absolute http(s) ACS from a SAML AuthnRequest, or null if missing/relative. */
export function absoluteHttpUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return trimmed
  } catch {
    return null
  }
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * Pick the Assertion Consumer Service URL for a SAML response.
 *
 * v1 posted to the ACS in the AuthnRequest. v2 stored only `samlAcsUrl` and
 * ignored the request, which broke custom SPs (Better Auth, etc.) whose
 * AuthnRequest ACS differs from a stale/homepage ACS in the app record.
 *
 * Prefer an absolute request ACS when it shares origin with the configured
 * ACS or the app URL. Otherwise keep the stored ACS.
 */
export function resolveAssertionConsumerServiceUrl(params: {
  configuredAcsUrl: string | null | undefined
  appUrl?: string | null
  requestedAcsUrl?: string | null
}): string | null {
  const configured = params.configuredAcsUrl?.trim() || ''
  const requested = absoluteHttpUrl(params.requestedAcsUrl)
  const originRef = configured || params.appUrl?.trim() || ''
  const origin = originRef ? originOf(originRef) : null

  if (requested) {
    if (!origin) return requested
    if (originOf(requested) === origin) return requested
  }

  return configured || null
}
