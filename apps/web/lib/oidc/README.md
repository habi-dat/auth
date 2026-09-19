# OIDC Provider (node-oidc-provider)

This app is an OpenID Connect / OAuth 2.0 authorization server. Endpoints are Next.js App Router routes under `/oidc` (same process as the rest of habidat-auth).

## Endpoints

Issuer: `{APP_URL}/oidc`

- Discovery: `{APP_URL}/oidc/.well-known/openid-configuration`
- Authorization: `{APP_URL}/oidc/auth`
- Token: `{APP_URL}/oidc/token`
- UserInfo: `{APP_URL}/oidc/userinfo`
- JWKS: `{APP_URL}/oidc/jwks`

## App configuration

1. Enable **OIDC** and set **Client ID**.
2. Set **Redirect URIs** as a JSON array, e.g. `["https://myapp.example/auth/callback"]`. If empty, `{App URL}/auth/callback` is used.
3. Optionally set **Client secret** for confidential clients (`client_secret_basic`). Leave empty for public clients (PKCE required).

Clients are loaded from the database on each lookup; no restart is needed after editing an app.

## Interaction (login)

Unauthorized authorization requests go to `/oidc-interaction/<uid>`, then `/login?callbackUrl=...` if there is no session. After login the user is returned to finish the code flow. App group restrictions are applied the same way as SAML.

## Environment

- `APP_URL` / `NEXT_PUBLIC_APP_URL`: public origin.
- `OIDC_COOKIE_KEYS`: comma-separated cookie signing keys. **Required in production** (habidat-setup writes this to `auth.env`).
- `OIDC_JWKS`: optional JSON JWKS. If unset, keys are created at `OIDC_JWKS_PATH` (default `/app/saml/oidc-jwks.json`, the SAML cert volume).
