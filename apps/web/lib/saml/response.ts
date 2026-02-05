import { getIdentityProvider, getServiceProvider } from './config'
import type { AppSaml } from './config'

export type SamlUser = {
  id: string
  email: string
  name: string
}

export interface SamlLoginRequest {
  query: { SAMLRequest?: string; RelayState?: string }
}

/** Result of parsing a SAML AuthnRequest; pass to createLoginResponse. */
export type ParsedLoginRequest = Awaited<ReturnType<ReturnType<typeof getIdentityProvider>['parseLoginRequest']>>

/**
 * Parse incoming SAML AuthnRequest (GET redirect binding).
 * @throws Promise rejection with string code on parse/signature failure
 */
export async function parseLoginRequest(
  app: AppSaml,
  req: SamlLoginRequest
): Promise<ParsedLoginRequest> {
  const idp = getIdentityProvider()
  const sp = getServiceProvider(app)
  const binding = 'redirect'
  return idp.parseLoginRequest(sp, binding, req)
}

/**
 * Create SAML Login response and POST binding context using samlify.
 * Returns context suitable for generateSamlPostForm (context is base64-encoded).
 */
export async function createLoginResponse(
  app: AppSaml,
  requestInfo: ParsedLoginRequest,
  user: SamlUser,
  relayState?: string | null
) {
  const idp = getIdentityProvider()
  const sp = getServiceProvider(app)
  const binding = 'post'
  return idp.createLoginResponse(sp, requestInfo, binding, { email: user.email, name: user.name }, undefined, undefined, relayState ?? undefined)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Generate HTML form that auto-posts SAMLResponse to SP ACS.
 * @param acsUrl - Assertion Consumer Service URL (e.g. result.entityEndpoint from createLoginResponse)
 * @param samlResponseBase64 - Base64-encoded SAML response (e.g. result.context from createLoginResponse)
 */
export function generateSamlPostForm(
  acsUrl: string,
  samlResponseBase64: string,
  relayState: string | null
): string {
  const state = relayState ? `\n    <input type="hidden" name="RelayState" value="${escapeHtml(relayState)}"/>` : ''
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><title>Redirecting...</title></head>
<body>
  <form id="saml-form" method="post" action="${escapeHtml(acsUrl)}">
    <input type="hidden" name="SAMLResponse" value="${escapeHtml(samlResponseBase64)}"/>${state}
    <noscript><button type="submit">Continue</button></noscript>
  </form>
  <script>document.getElementById('saml-form').submit();</script>
</body>
</html>
`
}
