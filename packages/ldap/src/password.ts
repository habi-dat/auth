import { createHash, randomBytes } from 'node:crypto'

/**
 * Hash a plain password with SSHA (Salted SHA-1) for LDAP userPassword.
 * Format: {SSHA}base64(sha1(password + salt) + salt)
 * OpenLDAP uses this for bind authentication by default.
 * @see https://www.openldap.org/faq/data/cache/347.html
 */
export function hashPasswordSsha(plainPassword: string): string {
  const salt = randomBytes(4)
  const hash = createHash('sha1')
  hash.update(plainPassword)
  hash.update(salt)
  const digest = hash.digest()
  const combined = Buffer.concat([digest, salt])
  return `{SSHA}${combined.toString('base64')}`
}

/**
 * Verify a plain password against an LDAP userPassword value (e.g. {SSHA}...).
 * Returns true if the password matches. Supports {SSHA} format.
 */
export function verifyPasswordSsha(hashedPassword: string, plainPassword: string): boolean {
  if (!hashedPassword.startsWith('{SSHA}')) return false
  const b64 = hashedPassword.slice(6).trim()
  let combined: Buffer
  try {
    combined = Buffer.from(b64, 'base64')
  } catch {
    return false
  }
  // SHA-1 digest is 20 bytes; remainder is salt (often 4 bytes)
  if (combined.length < 21) return false
  const digest = combined.subarray(0, 20)
  const salt = combined.subarray(20)
  const hash = createHash('sha1')
  hash.update(plainPassword)
  hash.update(salt)
  const computed = hash.digest()
  return digest.equals(computed)
}
