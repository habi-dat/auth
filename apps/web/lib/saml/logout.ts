import { getIdentityProvider, getServiceProvider } from './config'
import type { AppSaml } from './config'

export interface SamlLogoutRequest {
  query: { SAMLRequest?: string; RelayState?: string }
}

/** Result of parsing a SAML LogoutRequest; pass to createLogoutResponseRedirect. */
export interface ParsedLogoutRequest {
  samlContent: string
  extract: { request?: { id?: string }; [key: string]: unknown }
  sigAlg?: string | null
}

/**
 * Parse incoming SAML LogoutRequest from SP (GET redirect binding).
 * @throws Promise rejection on parse/signature failure
 */
export async function parseLogoutRequest(
  app: AppSaml,
  req: SamlLogoutRequest
): Promise<ParsedLogoutRequest> {
  const idp = getIdentityProvider()
  const sp = getServiceProvider(app)
  const binding = 'redirect'
  return idp.parseLogoutRequest(sp, binding, req)
}

/**
 * Create SAML LogoutResponse and return the redirect URL to the SP SLO endpoint.
 */
export function createLogoutResponseRedirect(
  app: AppSaml,
  requestInfo: ParsedLogoutRequest,
  relayState?: string | null
): string {
  const idp = getIdentityProvider()
  const sp = getServiceProvider(app)
  const binding = 'redirect'
  const result = idp.createLogoutResponse(sp, requestInfo, binding, relayState ?? '')
  return (result as { context: string }).context
}

/**
 * Create SAML LogoutRequest for IdP-initiated SLO; returns the full redirect URL to send the user to.
 */
export function createLogoutRequestRedirect(params: {
  app: AppSaml
  nameId: string
  sessionIndex?: string
}): string {
  const { app, nameId, sessionIndex } = params
  const idp = getIdentityProvider()
  const sp = getServiceProvider(app)
  const binding = 'redirect'
  const user = { logoutNameID: nameId, sessionIndex }
  const result = idp.createLogoutRequest(sp, binding, user, '')
  return (result as { context: string }).context
}
