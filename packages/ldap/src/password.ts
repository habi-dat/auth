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
