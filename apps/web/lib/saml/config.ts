import { existsSync, readFileSync } from 'node:fs'
import { IdentityProvider, ServiceProvider, setSchemaValidator } from 'samlify'
import { buildLoginResponseTemplate } from './template'

export type SamlUser = {
  id: string
  email: string
  username: string
  uid: string
  location: string | null
  title: string | null
  /** Group slugs (member groups + ancestor groups). Included in SAML attribute "groups". */
  groups?: string[]
}
// The doc says: "Your application is potentially vulnerable because no validation function found."
// We follow the old implementation here and skip validation.
setSchemaValidator({
  validate: () => Promise.resolve('skipped'),
})

const BINDING_REDIRECT = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect'
const BINDING_POST = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'

export function getAppUrl(): string {
  return process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function getSecret(envVar: string, filePath: string): string | undefined {
  const envValue = process.env[envVar]
  if (envValue) return envValue

  try {
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8').trim()
    }
  } catch (error) {
    console.error(`Failed to read SAML secret from ${filePath}:`, error)
  }
  return undefined
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
  privateKey: getSecret('SAML_PRIVATE_KEY', '/app/saml/key.pem'),
  certificate: getSecret('SAML_CERTIFICATE', '/app/saml/cert.cer'),
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
    entityID: url,
    loginResponseTemplate: {
      context: buildLoginResponseTemplate(),
      attributes: [],
    },
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
    assertionConsumerService: acsUrl
      ? [{ Binding: BINDING_POST, Location: acsUrl, isDefault: true }]
      : [],
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
