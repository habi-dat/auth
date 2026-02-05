import { getIdentityProvider } from './config'

/** Generate IdP metadata XML for SAML 2.0 using samlify. */
export function generateIdpMetadata(): string {
  const idp = getIdentityProvider()
  return idp.getMetadata()
}
