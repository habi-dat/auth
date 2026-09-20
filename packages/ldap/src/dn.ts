/** LDAP result code 32 = noSuchObject */
export function isNoSuchObjectError(err: unknown): boolean {
  if (err == null) return false
  const e = err as { name?: string; code?: number }
  return e.name === 'NoSuchObjectError' || e.code === 32
}

/** LDAP result code 16 = noSuchAttribute */
export function isNoSuchAttributeError(err: unknown): boolean {
  if (err == null) return false
  const e = err as { name?: string; code?: number }
  return e.name === 'NoSuchAttributeError' || e.code === 16
}

/** LDAP result code 20 = attributeOrValueExists */
export function isAttributeOrValueExistsError(err: unknown): boolean {
  if (err == null) return false
  const e = err as { name?: string; code?: number }
  return e.name === 'AttributeOrValueExistsError' || e.code === 20
}

export function rdnAttributeType(dn: string): string {
  const first = dn.split(',')[0] ?? ''
  const eq = first.indexOf('=')
  return eq > 0 ? first.slice(0, eq).trim().toLowerCase() : ''
}

export function rdnAttributeValue(dn: string): string {
  const first = dn.split(',')[0] ?? ''
  const eq = first.indexOf('=')
  return eq > 0 ? unescapeDnComponent(first.slice(eq + 1).trim()) : ''
}

export function normalizeDn(dn: string): string {
  return dn.trim().toLowerCase()
}

export function escapeLdapFilter(value: string): string {
  return value
    .replace(/\\/g, '\\5c')
    .replace(/[*()]/g, (c) => {
      if (c === '*') return '\\2a'
      if (c === '(') return '\\28'
      if (c === ')') return '\\29'
      return `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`
    })
    .replace(/\0/g, '\\00')
}

export function escapeDnComponent(value: string): string {
  // RFC 4514: escape space, ", #, +, ,, ;, <, =, >, \
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[+#,;<=>]/g, (c) => `\\${c}`)
    .replace(/^ /, '\\ ')
    .replace(/ $/, '\\ ')
}

function unescapeDnComponent(value: string): string {
  return value.replace(/\\(.)/g, '$1')
}

export function uidUserDn(uid: string, usersDn: string): string {
  return `uid=${escapeDnComponent(uid)},${usersDn}`
}

export function remapDns(dns: string[], map: Map<string, string>): string[] {
  return dns.map((dn) => map.get(normalizeDn(dn)) ?? dn)
}

export function dnsChanged(before: string[], after: string[]): boolean {
  if (before.length !== after.length) return true
  return before.some((dn, i) => normalizeDn(dn) !== normalizeDn(after[i] ?? ''))
}
