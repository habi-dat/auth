import { prisma } from '@habidat/db'
import type { Configuration, FindAccount } from 'oidc-provider'
import { HabidatOidcAdapter } from './adapter'
import { loadOidcJwks } from './jwks'

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
export const OIDC_ISSUER = `${APP_URL}/oidc`
export const OIDC_INTERACTION_PATH = '/oidc-interaction'

function oidcCookieKeys(): string[] {
  const fromEnv = process.env.OIDC_COOKIE_KEYS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromEnv && fromEnv.length > 0) return fromEnv
  if (process.env.NODE_ENV === 'production') {
    throw new Error('OIDC_COOKIE_KEYS is required in production')
  }
  return ['oidc-session-key-change-me']
}

export function createFindAccount(): FindAccount {
  return async (_ctx, sub: string) => {
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, name: true, username: true },
    })
    if (!user) return undefined
    return {
      accountId: user.id,
      claims: async () => ({
        sub: user.id,
        email: user.email,
        email_verified: true,
        name: user.name,
        preferred_username: user.username,
      }),
    }
  }
}

export function getOidcConfiguration(): Configuration {
  return {
    adapter: HabidatOidcAdapter,
    findAccount: createFindAccount(),
    jwks: loadOidcJwks(),
    clients: [],
    interactions: {
      url(_ctx, interaction) {
        return `${OIDC_INTERACTION_PATH}/${interaction.uid}`
      },
    },
    cookies: {
      keys: oidcCookieKeys(),
    },
    features: {
      devInteractions: { enabled: false },
    },
    pkce: {
      required: (_ctx, client) => client.tokenEndpointAuthMethod === 'none',
    },
    claims: {
      openid: ['sub'],
      email: ['email', 'email_verified'],
      profile: ['name', 'preferred_username'],
    },
    clientDefaults: {
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
  }
}
