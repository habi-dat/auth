export interface LdapConfig {
  url: string
  bindDn: string
  bindPassword: string
  baseDn: string
  usersDn: string
  groupsDn: string
}

export interface CreateUserData {
  username: string
  name: string
  email: string
  location?: string
  preferredLanguage?: string
  storageQuota?: string
  ldapUidNumber: number
  /** SSHA-hashed password for userPassword attribute; optional (e.g. for sync without password) */
  userPassword?: string
}

export interface UpdateUserData {
  name?: string
  email?: string
  location?: string
  preferredLanguage?: string
  storageQuota?: string
  /** SSHA-hashed password; only set when password was changed */
  userPassword?: string
}

export interface CreateGroupData {
  slug: string
  name: string
  description: string
  /** DNs of member users and/or groups (groupOfNames requires at least one) */
  memberDns: string[]
}

export interface UpdateGroupData {
  name?: string
  description?: string
  memberDns?: string[]
}

export interface LdapUserEntry {
  dn: string
  uid: string
  cn?: string
  mail?: string
  l?: string
  preferredLanguage?: string
  description?: string
  uidNumber?: string
  userPassword?: string
}

export interface LdapGroupEntry {
  dn: string
  cn: string
  o?: string
  description?: string
  member?: string[]
  /** Group admins (owner DNs) */
  owner?: string[]
}
