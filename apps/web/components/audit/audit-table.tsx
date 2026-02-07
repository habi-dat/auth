'use client'

import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { AuditDetailsDialog } from '@/components/audit/audit-details-dialog'
import { DataTable } from '@/components/ui/data-table'
import type { getAuditLogs } from '@/lib/audit'

type AuditRow = Awaited<ReturnType<typeof getAuditLogs>>[number]

const actionKeys: Record<AuditRow['action'], string> = {
  CREATE: 'actionCreate',
  UPDATE: 'actionUpdate',
  DELETE: 'actionDelete',
}

const entityTypeKeys: Record<AuditRow['entityType'], string> = {
  USER: 'entityUser',
  GROUP: 'entityGroup',
  INVITE: 'entityInvite',
  APP: 'entityApp',
  CATEGORY: 'entityCategory',
  SETTING: 'entitySetting',
}

function getEntityHref(row: AuditRow): string | null {
  switch (row.entityType) {
    case 'USER':
      return `/users/${row.entityId}`
    case 'GROUP':
      return `/groups/${row.entityId}`
    default:
      return null
  }
}

export function AuditTable({ logs }: { logs: AuditRow[] }) {
  const t = useTranslations('audit')

  const columns: ColumnDef<AuditRow>[] = [
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: t('date'),
      cell: ({ row }) => {
        const date = row.original.createdAt
        return (
          <span className="whitespace-nowrap text-muted-foreground">
            {new Date(date).toLocaleString('de-DE', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
        )
      },
    },
    {
      id: 'actor',
      header: t('actor'),
      cell: ({ row }) => {
        const actor = row.original.actor
        if (!actor) return <span className="text-muted-foreground">{t('system')}</span>
        return <span title={actor.email}>{actor.name ?? actor.email}</span>
      },
    },
    {
      id: 'action',
      accessorKey: 'action',
      header: t('action'),
      cell: ({ row }) => t(actionKeys[row.original.action]),
    },
    {
      id: 'entityType',
      accessorKey: 'entityType',
      header: t('entityType'),
      cell: ({ row }) => t(entityTypeKeys[row.original.entityType]),
    },
    {
      id: 'entityId',
      header: t('entityId'),
      cell: ({ row }) => {
        const meta = row.original.metadata as Record<string, unknown> | null
        const displayName = (meta?.entityName as string) ?? row.original.entityId
        const href = getEntityHref(row.original)
        if (href) {
          return (
            <Link
              href={href}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
              title={row.original.entityId}
            >
              {displayName}
            </Link>
          )
        }
        return (
          <span className="text-muted-foreground" title={row.original.entityId}>
            {displayName}
          </span>
        )
      },
    },
  ]

  const [selectedLog, setSelectedLog] = useState<AuditRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleRowClick = (row: AuditRow) => {
    setSelectedLog(row)
    setDialogOpen(true)
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={logs}
        emptyMessage={t('noLogs')}
        onRowClick={handleRowClick}
      />
      <AuditDetailsDialog
        log={selectedLog}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedLog(null)
        }}
      />
    </>
  )
}
