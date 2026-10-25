import Provider from 'oidc-provider'
import { getOidcConfiguration, OIDC_ISSUER } from './config'
import { oidcInteractionPolicy } from './session-check'

let provider: Provider | undefined

export function getOidcProvider(): Provider {
  if (!provider) {
    provider = new Provider(OIDC_ISSUER, getOidcConfiguration(oidcInteractionPolicy()))
    provider.proxy = true
  }
  return provider
}
