# OIDC Provider (node-oidc-provider)

This app acts as an OpenID Connect / OAuth 2.0 authorization server using [node-oidc-provider](https://github.com/panva/node-oidc-provider).

## Running with OIDC

- **Plain Next.js** (no OIDC): `pnpm dev`
- **Next.js + OIDC provider**: `pnpm dev:oidc`

The custom server (`server.ts`) runs both Next.js and the OIDC provider on the same port. OIDC routes are under `/oidc` (e.g. `/.well-known/openid-configuration`, `/auth`, `/token`, `/userinfo`). Issuer URL: `{APP_URL}/oidc`.

## App configuration

For an app to be an OIDC client:

1. Enable **OIDC** and set **Client ID** (e.g. app slug or custom id).
2. Set **Redirect URIs** as a JSON array, e.g. `["https://myapp.example/auth/callback"]`. If empty, `{App URL}/auth/callback` is used.
3. Optionally set **Client secret** for confidential clients; leave empty for public clients (e.g. SPAs with PKCE).

## Interaction (login)

When a user hits the authorization endpoint without a session, they are redirected to `/oidc-interaction`, then to `/login?callbackUrl=...` if not logged in. After login they are sent back to complete the OIDC flow.

## Environment

- `APP_URL` / `NEXT_PUBLIC_APP_URL`: Base URL (default `http://localhost:3000`).
- `OIDC_COOKIE_KEYS`: Comma-separated keys for signing cookies (default uses a single dev key).

## Database

Ensure the `App` model has `oidcRedirectUris` and `oidcClientSecret` (and existing `oidcEnabled`, `oidcClientId`). Run `prisma db push` or your migration to apply schema changes.
