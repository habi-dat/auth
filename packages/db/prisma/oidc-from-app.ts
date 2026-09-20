/** JSON → Prisma mapping for an appStore `oidc` block. */

export type OidcFields = {
  oidcEnabled: boolean
  oidcClientId: string | null
  oidcRedirectUris: string | null
  oidcClientSecret: string | null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim() !== '') {
      return value
    }
  }
  return null
}

function normalizeRedirectUris(raw: unknown): string | null {
  if (Array.isArray(raw)) {
    const uris = raw.filter((u): u is string => typeof u === 'string' && u.trim() !== '')
    return uris.length > 0 ? JSON.stringify(uris) : null
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return normalizeRedirectUris(parsed)
      }
    } catch {
      // A single URI string is accepted.
    }
    return JSON.stringify([raw.trim()])
  }
  return null
}

/** True when the stored app has no usable OIDC client yet. */
export function oidcIsUnconfigured(app: {
  oidcEnabled?: boolean | null
  oidcClientId?: string | null
}): boolean {
  return !app.oidcEnabled && (app.oidcClientId == null || app.oidcClientId === '')
}

export function oidcHasClient(fields: OidcFields): boolean {
  return fields.oidcEnabled || Boolean(fields.oidcClientId)
}

/**
 * Read OIDC client fields from an appStore JSON object.
 * Accepts `{ oidc: { enabled, clientId, clientSecret, redirectUris } }`
 * and the Prisma-shaped aliases (`oidcEnabled`, `oidcClientId`, …).
 */
export function oidcFieldsFromApp(app: { oidc?: unknown }): OidcFields {
  const empty: OidcFields = {
    oidcEnabled: false,
    oidcClientId: null,
    oidcRedirectUris: null,
    oidcClientSecret: null,
  }
  const oidc = app.oidc
  if (!oidc || typeof oidc !== 'object' || Array.isArray(oidc)) {
    return empty
  }
  const o = oidc as Record<string, unknown>
  return {
    oidcEnabled: o.enabled === true || o.oidcEnabled === true,
    oidcClientId: pickString(o, ['clientId', 'oidcClientId', 'client_id']),
    oidcRedirectUris: normalizeRedirectUris(
      o.redirectUris ?? o.oidcRedirectUris ?? o.redirect_uris
    ),
    oidcClientSecret: pickString(o, ['clientSecret', 'oidcClientSecret', 'client_secret']),
  }
}
