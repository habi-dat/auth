import { IdentityProvider, ServiceProvider } from 'samlify'

const BINDING_REDIRECT = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect'
const BINDING_POST = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'

export function getAppUrl(): string {
  return process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export const samlIdpConfig = {
  get entityId() {
    return `${getAppUrl()}/sso/metadata`
  },
  get ssoUrl() {
    return `${getAppUrl()}/sso/login`
  },
  get sloUrl() {
    return `${getAppUrl()}/sso/logout`
  },
  nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  assertionLifetimeMs: 5 * 60 * 1000, // 5 minutes
  privateKey: process.env.SAML_PRIVATE_KEY ?? undefined,
  certificate: process.env.SAML_CERTIFICATE ?? undefined,
} as const

export type AppSaml = {
  id: string
  slug: string
  samlEntityId: string | null
  samlAcsUrl: string | null
  samlSloUrl: string | null
  samlCertificate: string | null
}

function getIdpSettings() {
  const url = getAppUrl()
  const settings: Parameters<typeof IdentityProvider>[0] = {
    entityID: `${url}/sso/metadata`,
    singleSignOnService: [
      { Binding: BINDING_POST, Location: `${url}/sso/login`, isDefault: true },
      { Binding: BINDING_REDIRECT, Location: `${url}/sso/login` },
    ],
    singleLogoutService: [{ Binding: BINDING_REDIRECT, Location: `${url}/sso/logout` }],
    nameIDFormat: [samlIdpConfig.nameIdFormat],
  }
  if (samlIdpConfig.privateKey) settings.privateKey = samlIdpConfig.privateKey
  if (samlIdpConfig.certificate) settings.signingCert = samlIdpConfig.certificate
  return settings
}

function getSpSettings(app: AppSaml): Parameters<typeof ServiceProvider>[0] {
  const acsUrl = app.samlAcsUrl ?? ''
  const sloUrl = app.samlSloUrl ?? ''
  const settings: Parameters<typeof ServiceProvider>[0] = {
    entityID: app.samlEntityId ?? undefined,
    assertionConsumerService: acsUrl ? [{ Binding: BINDING_POST, Location: acsUrl, isDefault: true }] : [],
    singleLogoutService: sloUrl ? [{ Binding: BINDING_REDIRECT, Location: sloUrl }] : [],
  }
  if (app.samlCertificate) settings.signingCert = app.samlCertificate
  return settings
}

let cachedIdp: ReturnType<typeof IdentityProvider> | null = null

/** Get the global samlify Identity Provider instance. */
export function getIdentityProvider() {
  if (!cachedIdp) cachedIdp = IdentityProvider(getIdpSettings())
  return cachedIdp
}

/** Get a samlify Service Provider instance for the given app. */
export function getServiceProvider(app: AppSaml) {
  return ServiceProvider(getSpSettings(app))
}

/** Legacy: return app URLs/cert for code that still expects a plain config object. */
export function getServiceProviderConfig(app: AppSaml) {
  return {
    entityId: app.samlEntityId ?? undefined,
    assertionConsumerServiceUrl: app.samlAcsUrl ?? undefined,
    singleLogoutServiceUrl: app.samlSloUrl ?? undefined,
    certificate: app.samlCertificate ?? undefined,
  }
}
