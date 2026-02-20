import { prisma } from '@habidat/db'
import type { ClientMetadata, Configuration, FindAccount } from 'oidc-provider'

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
export const OIDC_ISSUER = `${APP_URL}/oidc`
export const OIDC_INTERACTION_PATH = '/oidc-interaction'

export type OidcApp = {
  id: string
  oidcClientId: string | null
  oidcRedirectUris: string | null
  oidcClientSecret: string | null
}

/** Load OIDC client config from apps that have OIDC enabled. */
export async function getOidcClientsFromDb(): Promise<ClientMetadata[]> {
  const apps = await prisma.app.findMany({
    where: { oidcEnabled: true, oidcClientId: { not: null } },
    select: {
      id: true,
      oidcClientId: true,
      oidcRedirectUris: true,
      oidcClientSecret: true,
      url: true,
    },
  })
  return apps
    .filter((a): a is typeof a & { oidcClientId: string } => a.oidcClientId != null)
    .map((app) => {
      let redirect_uris: string[] = []
      try {
        if (app.oidcRedirectUris) {
          const parsed = JSON.parse(app.oidcRedirectUris) as unknown
          redirect_uris = Array.isArray(parsed)
            ? parsed.filter((u): u is string => typeof u === 'string')
            : []
        }
      } catch {
        // ignore invalid JSON
      }
      if (redirect_uris.length === 0 && app.url) {
        redirect_uris = [`${app.url.replace(/\/$/, '')}/auth/callback`]
      }
      const client: ClientMetadata = {
        client_id: app.oidcClientId,
        redirect_uris,
        response_types: ['code'],
        grant_types: ['authorization_code', 'refresh_token'],
        scope: 'openid profile email',
        token_endpoint_auth_method: app.oidcClientSecret ? 'client_secret_basic' : 'none',
      }
      if (app.oidcClientSecret) client.client_secret = app.oidcClientSecret
      return client
    })
}

/** Build findAccount that resolves user from Prisma by sub (user id). */
export function createFindAccount(): FindAccount {
  return async (_ctx, sub: string) => {
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, name: true },
    })
    if (!user) return undefined
    return {
      accountId: user.id,
      claims: async (
        _use: string,
        _scope: string,
        _claims: { [key: string]: unknown },
        _rejected: string[]
      ) => ({
        sub: user.id,
        email: user.email,
        email_verified: true,
        name: user.name,
      }),
    }
  }
}

/** Build oidc-provider Configuration. */
export function getOidcConfiguration(
  _issuer: string,
  clients: ClientMetadata[],
  findAccount: FindAccount
): Configuration {
  const interactionUrl = `${APP_URL}${OIDC_INTERACTION_PATH}`
  return {
    clients,
    findAccount,
    interactions: {
      // Signature required by oidc-provider
      url(_ctx: unknown, _interaction: unknown) {
        return interactionUrl
      },
    },
    cookies: {
      keys: process.env.OIDC_COOKIE_KEYS
        ? (process.env.OIDC_COOKIE_KEYS as string).split(',').map((s) => s.trim())
        : ['oidc-session-key-change-me'],
    },
    features: {
      devInteractions: { enabled: false },
    },
  }
}
