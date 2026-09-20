/// <reference path="./ldapjs-client.d.ts" />
import LdapClient from 'ldapjs-client'
import {
  dnsChanged,
  escapeDnComponent,
  escapeLdapFilter,
  isAttributeOrValueExistsError,
  isNoSuchAttributeError,
  isNoSuchObjectError,
  normalizeDn,
  rdnAttributeType,
  rdnAttributeValue,
  remapDns,
  uidUserDn,
} from './dn.js'
import type {
  CreateGroupData,
  CreateUserData,
  LdapConfig,
  LdapGroupEntry,
  LdapUserEntry,
  UpdateGroupData,
  UpdateUserData,
} from './types.js'

/** ldapjs-client modifyDN always sends deleteOldRdn=true. Keep a spare cn so inetOrgPerson stays valid. */
const RDN_KEEP_CN = '__habidat_rdn__'

const USER_LIST_ATTRIBUTES = [
  'dn',
  'uid',
  'cn',
  'sn',
  'mail',
  'l',
  'preferredLanguage',
  'description',
  'uidNumber',
  'userPassword',
  'title',
  'ou',
]

const USER_SEARCH_ATTRIBUTES = [...USER_LIST_ATTRIBUTES, 'jpegPhoto']

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
        attributes: USER_SEARCH_ATTRIBUTES,
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
        attributes: USER_SEARCH_ATTRIBUTES,
        sizeLimit: 1,
      })
      if (!results || results.length === 0) return null
      return mapSearchEntryToUser(results[0] as Record<string, unknown>)
    } catch (err) {
      if (isNoSuchObjectError(err)) return null
      throw err
    }
  }

  /** Find user by exact cn under usersDn. Returns null if not found or more than one match. */
  async findUserByCn(cn: string): Promise<LdapUserEntry | null> {
    const client = this.ensureConnected()
    const filter = `(cn=${escapeLdapFilter(cn)})`
    try {
      const results = await client.search(this.config.usersDn, {
        filter,
        scope: 'one',
        attributes: USER_SEARCH_ATTRIBUTES,
        sizeLimit: 2,
      })
      if (!results || results.length !== 1) return null
      return mapSearchEntryToUser(results[0])
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
        attributes: USER_LIST_ATTRIBUTES,
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
      // inetOrgPerson requires sn. New users have no surname field; do not overwrite sn later.
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
    if (data.title != null && data.title.trim() !== '') entry.title = data.title.trim()
    if (data.ou != null && data.ou.trim() !== '') entry.ou = data.ou.trim()

    // jpegPhoto is binary; ldapjs-client's add() stringifies values and would
    // corrupt the JPEG. Create the entry first, then replace jpegPhoto.
    await client.add(dn, entry)
    if (data.jpegPhoto && data.jpegPhoto.length > 0) {
      await this.replaceJpegPhoto(dn, data.jpegPhoto)
    }

    return dn
  }

  async updateUser(dn: string, data: UpdateUserData): Promise<void> {
    const client = this.ensureConnected()
    const changes: Array<{
      operation: 'replace' | 'delete'
      modification: Record<string, string | Buffer | string[]>
    }> = []
    const rdnType = rdnAttributeType(dn)

    // Display name lives in cn. Skip the replace when cn is still the RDN
    // (pre-rewrite leftovers); OpenLDAP would return NamingViolation.
    if (data.name !== undefined && rdnType !== 'cn') {
      changes.push({ operation: 'replace', modification: { cn: data.name } })
    }
    if (data.email !== undefined)
      changes.push({ operation: 'replace', modification: { mail: data.email } })
    if (data.location !== undefined)
      changes.push({ operation: 'replace', modification: { l: data.location ?? '' } })
    if (data.preferredLanguage !== undefined)
      changes.push({
        operation: 'replace',
        modification: { preferredLanguage: data.preferredLanguage },
      })
    if (data.storageQuota !== undefined)
      changes.push({ operation: 'replace', modification: { description: data.storageQuota } })
    if (data.userPassword !== undefined)
      changes.push({ operation: 'replace', modification: { userPassword: data.userPassword } })
    if (data.title !== undefined)
      changes.push({ operation: 'replace', modification: { title: data.title } })
    if (data.ou !== undefined) changes.push({ operation: 'replace', modification: { ou: data.ou } })

    for (const change of changes) {
      const attr = Object.keys(change.modification)[0] ?? '?'
      try {
        await client.modify(dn, change)
      } catch (err) {
        throw wrapLdapError(err, `modify ${change.operation} ${attr} on ${dn}`)
      }
    }

    if (data.jpegPhoto === null) {
      await this.deleteJpegPhoto(dn)
    } else if (data.jpegPhoto !== undefined) {
      await this.replaceJpegPhoto(dn, data.jpegPhoto)
    }
  }

  /**
   * ldapjs-client stringifies modify values. Pass `{ type, vals: [Buffer] }`
   * so the JPEG stays binary (see Change.fromObject / Attribute.addValue).
   */
  private async replaceJpegPhoto(dn: string, jpegPhoto: Buffer): Promise<void> {
    const client = this.ensureConnected()
    try {
      await client.modify(dn, {
        operation: 'replace',
        modification: { type: 'jpegPhoto', vals: [jpegPhoto] },
      })
    } catch (err) {
      throw wrapLdapError(err, `modify replace jpegPhoto on ${dn}`)
    }
  }

  private async deleteJpegPhoto(dn: string): Promise<void> {
    const client = this.ensureConnected()
    try {
      await client.modify(dn, {
        operation: 'delete',
        modification: { type: 'jpegPhoto', vals: [] },
      })
    } catch (err) {
      if (!isNoSuchAttributeError(err)) throw err
    }
  }

  async deleteUser(dn: string): Promise<void> {
    const client = this.ensureConnected()
    await client.del(dn)
  }

  /**
   * One-time production cleanup: rename cn=<name> user DNs to uid=<uid> and
   * rewrite group member/owner. Idempotent. Throws if a cn-named user has no uid
   * so an empty-Postgres seed can retry.
   */
  async rewriteUserRdnsToUid(): Promise<{
    renamed: number
    alreadyUid: number
    groupsUpdated: number
  }> {
    const users = await this.listAllUsers()
    const renameMap = new Map<string, string>()
    let renamed = 0
    let alreadyUid = 0

    for (const user of users) {
      const uid = user.uid?.trim()
      const rdnType = rdnAttributeType(user.dn)
      if (rdnType === 'uid') {
        alreadyUid += 1
        continue
      }
      if (!uid) {
        throw new Error(`Cannot rewrite ${user.dn} to a uid RDN: entry has no uid`)
      }
      if (rdnType !== 'cn') {
        throw new Error(
          `Cannot rewrite ${user.dn}: expected cn= or uid= RDN, got ${rdnType || 'none'}`
        )
      }

      const newDn = await this.renameCnUserToUid(user, uid)
      renameMap.set(normalizeDn(user.dn), newDn)
      renamed += 1
    }

    const groups = await this.listAllGroups()
    let groupsUpdated = 0
    for (const group of groups) {
      const members = group.member ?? []
      const owners = group.owner ?? []
      const nextMembers = remapDns(members, renameMap)
      const nextOwners = remapDns(owners, renameMap)

      for (let i = 0; i < nextMembers.length; i++) {
        nextMembers[i] = await this.resolveUserDn(nextMembers[i] ?? '', renameMap)
      }
      for (let i = 0; i < nextOwners.length; i++) {
        nextOwners[i] = await this.resolveUserDn(nextOwners[i] ?? '', renameMap)
      }

      const memberChanged = dnsChanged(members, nextMembers)
      const ownerChanged = dnsChanged(owners, nextOwners)
      const patch: UpdateGroupData = {
        ...(memberChanged ? { memberDns: nextMembers } : {}),
        ...(ownerChanged && nextOwners.length > 0 ? { ownerDns: nextOwners } : {}),
      }
      if (patch.memberDns == null && patch.ownerDns == null) continue

      await this.updateGroup(group.dn, patch)
      groupsUpdated += 1
    }

    return { renamed, alreadyUid, groupsUpdated }
  }

  /**
   * ldapjs-client modifyDN always deletes the old RDN value. Add a spare cn
   * first so inetOrgPerson still has cn after the rename, then set cn to the
   * previous display name.
   */
  private async renameCnUserToUid(user: LdapUserEntry, uid: string): Promise<string> {
    const client = this.ensureConnected()
    const newDn = uidUserDn(uid, this.config.usersDn)
    if (normalizeDn(user.dn) === normalizeDn(newDn)) return newDn

    const existing = await this.findUserByDn(newDn)
    if (existing) {
      throw new Error(
        `Cannot rename ${user.dn} to ${newDn}: target already exists (${existing.dn})`
      )
    }

    const displayName = (user.cn && user.cn !== RDN_KEEP_CN ? user.cn : uid).trim()
    try {
      await client.modify(user.dn, {
        operation: 'add',
        modification: { cn: RDN_KEEP_CN },
      })
    } catch (err) {
      if (!isAttributeOrValueExistsError(err)) {
        throw wrapLdapError(err, `add spare cn on ${user.dn}`)
      }
    }

    try {
      await client.modifyDN(user.dn, `uid=${escapeDnComponent(uid)}`)
    } catch (err) {
      throw wrapLdapError(err, `modifyDN ${user.dn} -> uid=${uid}`)
    }

    try {
      await client.modify(newDn, {
        operation: 'replace',
        modification: { cn: displayName },
      })
    } catch (err) {
      throw wrapLdapError(err, `replace cn on ${newDn}`)
    }

    return newDn
  }

  /** Map a (possibly stale cn=) user DN to the current uid= DN. */
  private async resolveUserDn(dn: string, renameMap: Map<string, string>): Promise<string> {
    const trimmed = dn.trim()
    if (!trimmed) return trimmed
    const mapped = renameMap.get(normalizeDn(trimmed))
    if (mapped) return mapped

    const existing = await this.findUserByDn(trimmed)
    if (existing) return existing.dn

    const rdnType = rdnAttributeType(trimmed)
    const rdnValue = rdnAttributeValue(trimmed)
    if (!rdnValue) return trimmed

    if (rdnType === 'uid') {
      const byUid = await this.findUserByUsername(rdnValue)
      return byUid?.dn ?? trimmed
    }
    if (rdnType === 'cn') {
      const byCn = await this.findUserByCn(rdnValue)
      return byCn?.dn ?? trimmed
    }
    return trimmed
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
    const changes: Array<{
      operation: 'replace'
      modification: Record<string, string | string[]>
    }> = []

    if (data.name !== undefined)
      changes.push({ operation: 'replace', modification: { o: data.name } })
    if (data.description !== undefined)
      changes.push({ operation: 'replace', modification: { description: data.description } })
    if (data.memberDns !== undefined) {
      const member = data.memberDns.length > 0 ? data.memberDns : [this.config.usersDn]
      changes.push({ operation: 'replace', modification: { member } })
    }
    if (data.ownerDns !== undefined && data.ownerDns.length > 0) {
      changes.push({ operation: 'replace', modification: { owner: data.ownerDns } })
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

/** ldapjs-client builds errors as `new NamingViolationError(null)`, so .message is useless. */
function wrapLdapError(err: unknown, context: string): Error {
  if (err instanceof Error) {
    const detail = err.message && err.message !== 'null' ? err.message : err.name
    err.message = `${context}: ${detail}`
    return err
  }
  return new Error(`${context}: ${err != null ? String(err) : 'unknown'}`)
}

function mapSearchEntryToUser(entry: Record<string, unknown>): LdapUserEntry {
  const getStr = (k: string) =>
    Array.isArray(entry[k]) ? (entry[k] as string[])[0] : (entry[k] as string)
  return {
    dn: getStr('dn'),
    uid: getStr('uid'),
    cn: entry.cn != null ? getStr('cn') : undefined,
    sn: entry.sn != null ? getStr('sn') : undefined,
    mail: entry.mail != null ? getStr('mail') : undefined,
    l: entry.l != null ? getStr('l') : undefined,
    preferredLanguage: entry.preferredLanguage != null ? getStr('preferredLanguage') : undefined,
    description: entry.description != null ? getStr('description') : undefined,
    uidNumber: entry.uidNumber != null ? getStr('uidNumber') : undefined,
    userPassword: entry.userPassword != null ? getStr('userPassword') : undefined,
    title: entry.title != null ? getStr('title') : undefined,
    ou: entry.ou != null ? getStr('ou') : undefined,
    jpegPhoto: entry.jpegPhoto != null ? asJpegBuffer(entry.jpegPhoto) : undefined,
  }
}

function asJpegBuffer(value: unknown): Buffer | undefined {
  if (value == null) return undefined
  if (Buffer.isBuffer(value)) return value.length > 0 ? value : undefined
  if (value instanceof Uint8Array) {
    return value.length > 0 ? Buffer.from(value) : undefined
  }
  if (Array.isArray(value)) return asJpegBuffer(value[0])
  if (typeof value === 'string' && value.length > 0) return Buffer.from(value, 'binary')
  return undefined
}

function mapSearchEntryToGroup(entry: Record<string, unknown>): LdapGroupEntry {
  const getStr = (k: string) =>
    Array.isArray(entry[k]) ? (entry[k] as string[])[0] : (entry[k] as string)
  const getArr = (k: string) =>
    Array.isArray(entry[k]) ? (entry[k] as string[]) : entry[k] ? [getStr(k)] : []
  return {
    dn: getStr('dn'),
    cn: getStr('cn'),
    o: entry.o != null ? getStr('o') : undefined,
    description: entry.description != null ? getStr('description') : undefined,
    member: entry.member != null ? getArr('member') : undefined,
    owner: entry.owner != null ? getArr('owner') : undefined,
  }
}
