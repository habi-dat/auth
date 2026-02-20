'use client'

import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { SyncDetailsDialog } from '@/components/sync/sync-details-dialog'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import type { getSyncEvents } from '@/lib/sync/get-sync-events'

type SyncRow = Awaited<ReturnType<typeof getSyncEvents>>[number]

function getEntityHref(row: SyncRow): string | null {
  switch (row.entityType) {
    case 'USER':
      return `/users/${row.entityId}`
    case 'GROUP':
      return `/groups/${row.entityId}`
    default:
      return null
  }
}

function statusVariant(
  status: SyncRow['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'COMPLETED':
      return 'default'
    case 'FAILED':
      return 'destructive'
    case 'PENDING':
    case 'RETRYING':
      return 'secondary'
    case 'PROCESSING':
      return 'outline'
    default:
      return 'secondary'
  }
}

export function SyncTable({ events }: { events: SyncRow[] }) {
  const t = useTranslations('sync')
  const [selectedEvent, setSelectedEvent] = useState<SyncRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const columns: ColumnDef<SyncRow>[] = [
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: t('createdAt'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleString('de-DE', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      id: 'target',
      accessorKey: 'target',
      header: t('target'),
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {row.original.target}
        </Badge>
      ),
    },
    {
      id: 'operation',
      accessorKey: 'operation',
      header: t('operation'),
      cell: ({ row }) => row.original.operation,
    },
    {
      id: 'entityType',
      accessorKey: 'entityType',
      header: t('entityType'),
      cell: ({ row }) => row.original.entityType,
    },
    {
      id: 'entityId',
      header: t('entityId'),
      cell: ({ row }) => {
        const displayName = row.original.entityName ?? row.original.entityId
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
    {
      id: 'status',
      accessorKey: 'status',
      header: t('status'),
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge>
      ),
    },
    {
      id: 'attempts',
      header: t('attempts'),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.attempts}/{row.original.maxAttempts}
        </span>
      ),
    },
    {
      id: 'lastError',
      header: t('lastError'),
      cell: ({ row }) => {
        const err = row.original.lastError
        if (!err) return <span className="text-muted-foreground">—</span>
        return (
          <span className="max-w-[180px] truncate block text-destructive text-sm" title={err}>
            {err}
          </span>
        )
      },
    },
  ]

  const handleRowClick = (row: SyncRow) => {
    setSelectedEvent(row)
    setDialogOpen(true)
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={events}
        emptyMessage={t('noEvents')}
        onRowClick={handleRowClick}
      />
      <SyncDetailsDialog
        event={selectedEvent}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedEvent(null)
        }}
      />
    </>
  )
}
