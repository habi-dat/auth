import type { Adapter, AdapterPayload } from 'oidc-provider'
import { findOidcClientById } from './clients'
import { type OidcStored, oidcStorage, sweepExpiredOidc } from './store'

const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
])

function storage() {
  return oidcStorage()
}

function grantKey(grantId: string) {
  return `grant:${grantId}`
}

function sessionUidKey(uid: string) {
  return `sessionUid:${uid}`
}

function userCodeKey(userCode: string) {
  return `userCode:${userCode}`
}

function isExpired(entry: OidcStored | undefined, now = Date.now()): boolean {
  return !!entry?.expiresAt && entry.expiresAt <= now
}

function read(key: string): OidcStored | undefined {
  const entry = storage().get(key)
  if (!entry) return undefined
  if (isExpired(entry)) {
    storage().delete(key)
    return undefined
  }
  return entry
}

/**
 * In-memory grant/session store plus Prisma-backed OIDC clients so app edits
 * apply without restarting the process.
 */
export class HabidatOidcAdapter implements Adapter {
  constructor(private model: string) {}

  private key(id: string) {
    return `${this.model}:${id}`
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    sweepExpiredOidc()
    const key = this.key(id)
    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined
    storage().set(key, { payload, expiresAt })

    if (this.model === 'Session' && payload.uid) {
      storage().set(sessionUidKey(payload.uid), { payload: { id } as AdapterPayload, expiresAt })
    }
    if (grantable.has(this.model) && payload.grantId) {
      const gKey = grantKey(payload.grantId)
      const existing = read(gKey)
      const keys = Array.isArray(existing?.payload)
        ? [...(existing.payload as unknown as string[])]
        : []
      if (!keys.includes(key)) keys.push(key)
      const grantExpires =
        existing?.expiresAt && expiresAt
          ? Math.max(existing.expiresAt, expiresAt)
          : (expiresAt ?? existing?.expiresAt)
      storage().set(gKey, { payload: keys as unknown as AdapterPayload, expiresAt: grantExpires })
    }
    if (payload.userCode) {
      storage().set(userCodeKey(payload.userCode), { payload: { id } as AdapterPayload, expiresAt })
    }
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    if (this.model === 'Client') {
      return findOidcClientById(id)
    }
    return read(this.key(id))?.payload
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const ref = read(sessionUidKey(uid))
    const id = (ref?.payload as { id?: string } | undefined)?.id
    if (!id) return undefined
    return this.find(id)
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const ref = read(userCodeKey(userCode))
    const id = (ref?.payload as { id?: string } | undefined)?.id
    if (!id) return undefined
    return this.find(id)
  }

  async consume(id: string): Promise<void> {
    const entry = read(this.key(id))
    if (entry) {
      entry.payload.consumed = Math.floor(Date.now() / 1000)
    }
  }

  async destroy(id: string): Promise<void> {
    storage().delete(this.key(id))
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const gKey = grantKey(grantId)
    const existing = read(gKey)
    const keys = Array.isArray(existing?.payload) ? (existing.payload as unknown as string[]) : []
    for (const key of keys) storage().delete(key)
    storage().delete(gKey)
  }
}
