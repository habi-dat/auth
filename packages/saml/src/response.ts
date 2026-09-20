import type { AppSaml, SamlUser } from './config'
import { getIdentityProvider, getServiceProvider } from './config'
import { createTemplateCallback } from './template'

export interface SamlLoginRequest {
  query?: { SAMLRequest?: string; RelayState?: string }
  body?: { SAMLRequest?: string; RelayState?: string }
}

/** Result of parsing a SAML AuthnRequest; pass to createLoginResponse. */
export type ParsedLoginRequest = Awaited<
  ReturnType<ReturnType<typeof getIdentityProvider>['parseLoginRequest']>
>

/**
 * Parse incoming SAML AuthnRequest (HTTP-Redirect or HTTP-POST).
 * @throws Promise rejection with string code on parse/signature failure
 */
export async function parseLoginRequest(
  app: AppSaml,
  req: SamlLoginRequest,
  binding: 'redirect' | 'post' = 'redirect'
): Promise<ParsedLoginRequest> {
  const idp = getIdentityProvider()
  const sp = getServiceProvider(app)
  return idp.parseLoginRequest(sp, binding, req)
}

/**
 * Create SAML Login response and POST binding context using samlify.
 * Returns context suitable for generateSamlPostForm (context is base64-encoded).
 */
function samlRequestId(extract: ParsedLoginRequest['extract']): string {
  const id = extract.request?.id
  if (typeof id === 'string' && id.length > 0) return id
  if (Array.isArray(id) && typeof id[0] === 'string' && id[0].length > 0) return id[0]
  throw new Error('SAML AuthnRequest is missing an ID')
}

export async function createLoginResponse(
  app: AppSaml,
  requestInfo: ParsedLoginRequest,
  user: SamlUser,
  relayState?: string | null
) {
  const idp = getIdentityProvider()
  const sp = getServiceProvider(app)
  const binding = 'post'

  const result = await idp.createLoginResponse(
    sp,
    { extract: requestInfo.extract },
    binding,
    user,
    createTemplateCallback(idp, sp, user, samlRequestId(requestInfo.extract)),
    false,
    relayState ?? undefined
  )
  if (!('entityEndpoint' in result)) {
    throw new Error('Expected a SAML POST binding response')
  }
  return result
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
  const state = relayState
    ? `\n    <input type="hidden" name="RelayState" value="${escapeHtml(relayState)}"/>`
    : ''
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
