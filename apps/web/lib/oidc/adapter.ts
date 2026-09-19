import type { Adapter, AdapterPayload } from 'oidc-provider'
import { findOidcClientById } from './clients'

type Stored = { payload: AdapterPayload; expiresAt?: number }

const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
])

const storage = new Map<string, Stored>()

function grantKey(grantId: string) {
  return `grant:${grantId}`
}

function sessionUidKey(uid: string) {
  return `sessionUid:${uid}`
}

function userCodeKey(userCode: string) {
  return `userCode:${userCode}`
}

function isExpired(entry: Stored | undefined): boolean {
  return !!entry?.expiresAt && entry.expiresAt <= Date.now()
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
    const key = this.key(id)
    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined
    storage.set(key, { payload, expiresAt })

    if (this.model === 'Session' && payload.uid) {
      storage.set(sessionUidKey(payload.uid), { payload: { id } as AdapterPayload, expiresAt })
    }
    if (grantable.has(this.model) && payload.grantId) {
      const gKey = grantKey(payload.grantId)
      const existing = storage.get(gKey)
      const keys = Array.isArray(existing?.payload)
        ? [...(existing.payload as unknown as string[])]
        : []
      keys.push(key)
      storage.set(gKey, { payload: keys as unknown as AdapterPayload })
    }
    if (payload.userCode) {
      storage.set(userCodeKey(payload.userCode), { payload: { id } as AdapterPayload, expiresAt })
    }
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    if (this.model === 'Client') {
      return findOidcClientById(id)
    }
    const entry = storage.get(this.key(id))
    if (!entry || isExpired(entry)) {
      if (entry) storage.delete(this.key(id))
      return undefined
    }
    return entry.payload
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const ref = storage.get(sessionUidKey(uid))
    const id = (ref?.payload as { id?: string } | undefined)?.id
    if (!id) return undefined
    return this.find(id)
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const ref = storage.get(userCodeKey(userCode))
    const id = (ref?.payload as { id?: string } | undefined)?.id
    if (!id) return undefined
    return this.find(id)
  }

  async consume(id: string): Promise<void> {
    const entry = storage.get(this.key(id))
    if (entry) {
      entry.payload.consumed = Math.floor(Date.now() / 1000)
    }
  }

  async destroy(id: string): Promise<void> {
    storage.delete(this.key(id))
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const gKey = grantKey(grantId)
    const existing = storage.get(gKey)
    const keys = Array.isArray(existing?.payload) ? (existing.payload as unknown as string[]) : []
    for (const key of keys) storage.delete(key)
    storage.delete(gKey)
  }
}
