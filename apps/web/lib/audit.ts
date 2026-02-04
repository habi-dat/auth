import { type AuditAction, type AuditEntityType, prisma } from '@habidat/db'

/** Deep equality for JSON-serializable values (used to detect changed attributes). */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Returns keys that have different values between oldObj and newObj. */
function getChangedKeys(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): string[] {
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
  const changed: string[] = []
  for (const key of keys) {
    if (!jsonEqual(oldObj[key], newObj[key])) changed.push(key)
  }
  return changed
}

function pick<T>(obj: Record<string, T>, keys: string[]): Record<string, T> {
  const out: Record<string, T> = {}
  for (const k of keys) {
    if (k in obj) out[k] = obj[k]
  }
  return out
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export interface CreateAuditLogParams {
  actorId: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  /** Full old state (delete/update). For update, only changed keys are stored. */
  oldValue?: unknown
  /** Full new state (create/update). For update, only changed keys are stored. */
  newValue?: unknown
  metadata?: Record<string, unknown>
  /** Display name for the entity (e.g. user name, group name). Stored in metadata.entityName. */
  entityName?: string
}

export async function createAuditLog(params: CreateAuditLogParams) {
  let oldValue: unknown = params.oldValue
  let newValue: unknown = params.newValue

  // For UPDATE: keep only changed attributes in oldValue and newValue
  if (
    params.oldValue != null &&
    params.newValue != null &&
    isPlainObject(params.oldValue) &&
    isPlainObject(params.newValue)
  ) {
    const changedKeys = getChangedKeys(params.oldValue, params.newValue)
    if (changedKeys.length > 0) {
      oldValue = pick(params.oldValue, changedKeys)
      newValue = pick(params.newValue, changedKeys)
    } else {
      oldValue = undefined
      newValue = undefined
    }
  }

  const metadata: Record<string, unknown> = {
    ...(params.metadata ?? {}),
    ...(params.entityName != null && params.entityName !== '' && { entityName: params.entityName }),
  }

  return prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: oldValue != null ? JSON.parse(JSON.stringify(oldValue)) : undefined,
      newValue: newValue != null ? JSON.parse(JSON.stringify(newValue)) : undefined,
      metadata: Object.keys(metadata).length > 0 ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  })
}

// Helper to get recent audit logs for an entity
export async function getAuditLogsForEntity(entityType: AuditEntityType, entityId: string) {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      actor: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

// Helper to get recent audit logs for a user's actions
export async function getAuditLogsByActor(actorId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { actorId },
    include: {
      actor: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

// Get recent audit logs for the audit log page (admin)
export async function getAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
    include: {
      actor: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
