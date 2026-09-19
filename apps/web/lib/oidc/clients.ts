import { prisma } from '@habidat/db'
import type { AdapterPayload, ClientMetadata } from 'oidc-provider'

export function appToClientMetadata(app: {
  oidcClientId: string
  oidcRedirectUris: string | null
  oidcClientSecret: string | null
  url: string
}): ClientMetadata {
  let redirect_uris: string[] = []
  try {
    if (app.oidcRedirectUris) {
      const parsed = JSON.parse(app.oidcRedirectUris) as unknown
      redirect_uris = Array.isArray(parsed)
        ? parsed.filter((u): u is string => typeof u === 'string')
        : []
    }
  } catch {
    redirect_uris = []
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
}

export async function findOidcClientById(clientId: string): Promise<AdapterPayload | undefined> {
  const app = await prisma.app.findFirst({
    where: { oidcEnabled: true, oidcClientId: clientId },
    select: {
      oidcClientId: true,
      oidcRedirectUris: true,
      oidcClientSecret: true,
      url: true,
    },
  })
  if (!app?.oidcClientId) return undefined
  return appToClientMetadata({ ...app, oidcClientId: app.oidcClientId })
}
