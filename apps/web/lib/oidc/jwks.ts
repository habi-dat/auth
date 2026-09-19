import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { JWKS } from 'oidc-provider'

const JWKS_PATH = process.env.OIDC_JWKS_PATH ?? '/app/saml/oidc-jwks.json'

function generateRsaJwks(): JWKS {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = privateKey.export({ format: 'jwk' })
  return {
    keys: [
      {
        ...jwk,
        kid: 'habidat-oidc-1',
        use: 'sig',
        alg: 'RS256',
      },
    ],
  }
}

function parseJwks(raw: string): JWKS | null {
  try {
    const parsed = JSON.parse(raw) as JWKS
    if (Array.isArray(parsed.keys) && parsed.keys.length > 0) return parsed
  } catch {
    return null
  }
  return null
}

/** Load persistent signing keys, or create and store them when possible. */
export function loadOidcJwks(): JWKS {
  if (process.env.OIDC_JWKS) {
    const fromEnv = parseJwks(process.env.OIDC_JWKS)
    if (fromEnv) return fromEnv
  }

  if (existsSync(JWKS_PATH)) {
    const fromFile = parseJwks(readFileSync(JWKS_PATH, 'utf8'))
    if (fromFile) return fromFile
  }

  const generated = generateRsaJwks()
  try {
    mkdirSync(dirname(JWKS_PATH), { recursive: true })
    writeFileSync(JWKS_PATH, JSON.stringify(generated), { mode: 0o600 })
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `OIDC JWKS could not be persisted at ${JWKS_PATH}. Set OIDC_JWKS or mount a writable path.`
      )
    }
    console.warn('OIDC JWKS not persisted; tokens will be invalid after restart.', error)
  }
  return generated
}
