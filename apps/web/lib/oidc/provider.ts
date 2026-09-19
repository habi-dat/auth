import Provider from 'oidc-provider'
import { getOidcConfiguration, OIDC_ISSUER } from './config'

let provider: Provider | undefined

export function getOidcProvider(): Provider {
  if (!provider) {
    provider = new Provider(OIDC_ISSUER, getOidcConfiguration())
    provider.proxy = true
  }
  return provider
}
