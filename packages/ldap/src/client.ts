/// <reference path="./ldapjs-client.d.ts" />
import LdapClient from 'ldapjs-client'
import type {
  CreateGroupData,
  CreateUserData,
  LdapConfig,
  LdapGroupEntry,
  LdapUserEntry,
  UpdateGroupData,
  UpdateUserData,
} from './types.js'

export class LdapService {
  private client: LdapClient | null = null
  private config: LdapConfig

  constructor(config: LdapConfig) {
    this.config = config
  }

  getUsersDn(): string {
    return this.config.usersDn
  }

  getGroupsDn(): string {
    return this.config.groupsDn
  }

  async connect(): Promise<void> {
    this.client = new LdapClient({ url: this.config.url })
    await this.client.bind(this.config.bindDn, this.config.bindPassword)
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.unbind()
      } catch {
        // ignore
      }
      this.client = null
    }
  }

  private ensureConnected(): LdapClient {
    if (!this.client) {
      throw new Error('LDAP client not connected')
    }
    return this.client
  }

  /** Find user by uid (username) under usersDn. Returns null if not found or base DN missing. */
  async findUserByUsername(username: string): Promise<LdapUserEntry | null> {
    const client = this.ensureConnected()
    const filter = `(uid=${escapeLdapFilter(username)})`
    try {
      const results = await client.search(this.config.usersDn, {
        filter,
        scope: 'one',
        attributes: ['dn', 'uid', 'cn', 'mail', 'l', 'preferredLanguage', 'description', 'uidNumber', 'userPassword'],
        sizeLimit: 1,
      })
      if (!results || results.length === 0) return null
      return mapSearchEntryToUser(results[0])
    } catch (err) {
      if (isNoSuchObjectError(err)) return null
      throw err
    }
  }

  /** Find user by DN (base search). Use when ldapDn is known so lookup works after username change. Returns null if not found. */
  async findUserByDn(dn: string): Promise<LdapUserEntry | null> {
    const client = this.ensureConnected()
    try {
      const results = await client.search(dn, {
        scope: 'base',
        filter: '(objectClass=*)',
        attributes: ['dn', 'uid', 'cn', 'mail', 'l', 'preferredLanguage', 'description', 'uidNumber', 'userPassword'],
        sizeLimit: 1,
      })
      if (!results || results.length === 0) return null
      return mapSearchEntryToUser(results[0] as Record<string, unknown>)
    } catch (err) {
      if (isNoSuchObjectError(err)) return null
      throw err
    }
  }

  /** Find group by cn (slug) under groupsDn. Returns null if not found or base DN missing. */
  async findGroupBySlug(slug: string): Promise<LdapGroupEntry | null> {
    const client = this.ensureConnected()
    const filter = `(cn=${escapeLdapFilter(slug)})`
    try {
      const results = await client.search(this.config.groupsDn, {
        filter,
        scope: 'one',
        attributes: ['dn', 'cn', 'o', 'description', 'member', 'owner'],
        sizeLimit: 1,
      })
      if (!results || results.length === 0) return null
      return mapSearchEntryToGroup(results[0])
    } catch (err) {
      if (isNoSuchObjectError(err)) return null
      throw err
    }
  }

  /** List all user entries under usersDn (for LDAP import). */
  async listAllUsers(): Promise<LdapUserEntry[]> {
    const client = this.ensureConnected()
    try {
      const results = await client.search(this.config.usersDn, {
        filter: '(objectClass=inetOrgPerson)',
        scope: 'one',
        attributes: ['dn', 'uid', 'cn', 'sn', 'mail', 'l', 'preferredLanguage', 'description', 'uidNumber', 'userPassword'],
      })
      if (!results || results.length === 0) return []
      return results.map((entry) => mapSearchEntryToUser(entry as Record<string, unknown>))
    } catch (err) {
      if (isNoSuchObjectError(err)) return []
      throw err
    }
  }

  /** List all group entries under groupsDn (for LDAP import). Includes member and owner. */
  async listAllGroups(): Promise<LdapGroupEntry[]> {
    const client = this.ensureConnected()
    try {
      const results = await client.search(this.config.groupsDn, {
        filter: '(objectClass=*)',
        scope: 'one',
        attributes: ['dn', 'cn', 'o', 'description', 'member', 'owner'],
      })
      if (!results || results.length === 0) return []
      return results.map((entry) => mapSearchEntryToGroup(entry as Record<string, unknown>))
    } catch (err) {
      if (isNoSuchObjectError(err)) return []
      throw err
    }
  }

  async createUser(data: CreateUserData): Promise<string> {
    const client = this.ensureConnected()
    const dn = `uid=${escapeDnComponent(data.username)},${this.config.usersDn}`

    // All attribute values sent as strings for schema compatibility (uidNumber/gidNumber
    // are INTEGER syntax but many servers accept string representation; avoid InvalidAttributeSyntaxError).
    const entry: Record<string, string | string[]> = {
      objectClass: ['inetOrgPerson', 'posixAccount', 'organizationalPerson'],
      uid: data.username,
      cn: data.name,
      sn: data.name,
      mail: data.email,
      uidNumber: String(data.ldapUidNumber),
      gidNumber: '500',
      homeDirectory: `/home/${data.username}`,
    }
    if (data.location != null && data.location.trim() !== '') entry.l = data.location.trim()
    if (data.preferredLanguage != null && data.preferredLanguage.trim() !== '')
      entry.preferredLanguage = data.preferredLanguage.trim()
    if (data.storageQuota != null && data.storageQuota.trim() !== '')
      entry.description = data.storageQuota.trim()
    if (data.userPassword != null && data.userPassword.trim() !== '')
      entry.userPassword = data.userPassword.trim()

    await client.add(dn, entry)

    return dn
  }

  async updateUser(dn: string, data: UpdateUserData): Promise<void> {
    const client = this.ensureConnected()
    const changes: Array<{ operation: 'replace'; modification: Record<string, string> }> = []

    if (data.name !== undefined)
      changes.push({ operation: 'replace', modification: { cn: data.name, sn: data.name } })
    if (data.email !== undefined) changes.push({ operation: 'replace', modification: { mail: data.email } })
    if (data.location !== undefined) changes.push({ operation: 'replace', modification: { l: data.location ?? '' } })
    if (data.preferredLanguage !== undefined)
      changes.push({ operation: 'replace', modification: { preferredLanguage: data.preferredLanguage } })
    if (data.storageQuota !== undefined)
      changes.push({ operation: 'replace', modification: { description: data.storageQuota } })
    if (data.userPassword !== undefined)
      changes.push({ operation: 'replace', modification: { userPassword: data.userPassword } })

    for (const change of changes) {
      await client.modify(dn, change)
    }
  }

  async deleteUser(dn: string): Promise<void> {
    const client = this.ensureConnected()
    await client.del(dn)
  }

  async createGroup(data: CreateGroupData): Promise<string> {
    const client = this.ensureConnected()
    const dn = `cn=${escapeDnComponent(data.slug)},${this.config.groupsDn}`

    // groupOfNames requires at least one member; use placeholder if empty
    const member = data.memberDns.length > 0 ? data.memberDns : [this.config.usersDn]

    await client.add(dn, {
      objectClass: 'groupOfNames',
      cn: data.slug,
      o: data.name,
      description: data.description,
      member,
    })

    return dn
  }

  async updateGroup(dn: string, data: UpdateGroupData): Promise<void> {
    const client = this.ensureConnected()
    const changes: Array<{ operation: 'replace'; modification: Record<string, string | string[]> }> = []

    if (data.name !== undefined) changes.push({ operation: 'replace', modification: { o: data.name } })
    if (data.description !== undefined)
      changes.push({ operation: 'replace', modification: { description: data.description } })
    if (data.memberDns !== undefined) {
      const member = data.memberDns.length > 0 ? data.memberDns : [this.config.usersDn]
      changes.push({ operation: 'replace', modification: { member } })
    }

    for (const change of changes) {
      await client.modify(dn, change)
    }
  }

  async deleteGroup(dn: string): Promise<void> {
    const client = this.ensureConnected()
    await client.del(dn)
  }

  /**
   * Ensure an organizationalUnit entry exists. Creates it if missing.
   * dn must be of the form ou=<value>,... (e.g. ou=users,dc=example,dc=com).
   */
  async ensureOrganizationalUnit(dn: string): Promise<void> {
    const client = this.ensureConnected()
    try {
      const results = await client.search(dn, {
        scope: 'base',
        filter: '(objectclass=*)',
        sizeLimit: 1,
      })
      if (results && results.length > 0) return
    } catch (err) {
      if (!isNoSuchObjectError(err)) throw err
    }
    const match = dn.match(/^ou=([^,]+)/i)
    const ouValue = match ? match[1].replace(/\\,/g, ',') : dn.split(',')[0].replace(/^ou=/i, '')
    await client.add(dn, {
      objectClass: 'organizationalUnit',
      ou: ouValue,
    })
  }
}

/** LDAP result code 32 = noSuchObject (entry or base doesn't exist) */
function isNoSuchObjectError(err: unknown): boolean {
  if (err == null) return false
  const e = err as { name?: string; code?: number }
  return e.name === 'NoSuchObjectError' || e.code === 32
}

function escapeLdapFilter(value: string): string {
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

function escapeDnComponent(value: string): string {
  // RFC 4514: escape space, ", #, +, ,, ;, <, =, >, \
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[+#,;<=>]/g, (c) => `\\${c}`)
    .replace(/^ /, '\\ ')
    .replace(/ $/, '\\ ')
}

function mapSearchEntryToUser(entry: Record<string, unknown>): LdapUserEntry {
  const getStr = (k: string) => (Array.isArray(entry[k]) ? (entry[k] as string[])[0] : (entry[k] as string))
  return {
    dn: getStr('dn'),
    uid: getStr('uid'),
    cn: entry.cn != null ? getStr('cn') : undefined,
    mail: entry.mail != null ? getStr('mail') : undefined,
    l: entry.l != null ? getStr('l') : undefined,
    preferredLanguage: entry.preferredLanguage != null ? getStr('preferredLanguage') : undefined,
    description: entry.description != null ? getStr('description') : undefined,
    uidNumber: entry.uidNumber != null ? getStr('uidNumber') : undefined,
    userPassword: entry.userPassword != null ? getStr('userPassword') : undefined,
  }
}

function mapSearchEntryToGroup(entry: Record<string, unknown>): LdapGroupEntry {
  const getStr = (k: string) => (Array.isArray(entry[k]) ? (entry[k] as string[])[0] : (entry[k] as string))
  const getArr = (k: string) => (Array.isArray(entry[k]) ? (entry[k] as string[]) : entry[k] ? [getStr(k)] : [])
  return {
    dn: getStr('dn'),
    cn: getStr('cn'),
    o: entry.o != null ? getStr('o') : undefined,
    description: entry.description != null ? getStr('description') : undefined,
    member: entry.member != null ? getArr('member') : undefined,
    owner: entry.owner != null ? getArr('owner') : undefined,
  }
}
