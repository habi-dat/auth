import { type AuditAction, type AuditEntityType, prisma } from '@habidat/db'

interface CreateAuditLogParams {
  actorId: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  oldValue?: unknown
  newValue?: unknown
  metadata?: Record<string, unknown>
}

export async function createAuditLog(params: CreateAuditLogParams) {
  return prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : undefined,
      newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : undefined,
      metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
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
