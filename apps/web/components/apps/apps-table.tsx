'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Key, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import { BadgeList, DeleteAction, EditAction, RowActions } from '@/components/ui/data-table-cells'
import { deleteAppAction, type getApps } from '@/lib/actions/app-actions'

type AppRow = Awaited<ReturnType<typeof getApps>>[number]

export function AppsTable({ apps }: { apps: AppRow[] }) {
  const t = useTranslations('apps')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<AppRow | null>(null)

  const deleteAction = useAction(deleteAppAction, {
    onSuccess: () => {
      setDeleteTarget(null)
      router.refresh()
    },
  })

  const columns: ColumnDef<AppRow>[] = [
    {
      accessorKey: 'name',
      header: t('name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.iconUrl ? (
            // biome-ignore lint/performance/noImgElement: icons are not optimized
            <img
              src={row.original.iconUrl}
              alt=""
              className="h-6 w-6 rounded object-contain"
              width={24}
              height={24}
            />
          ) : null}
          <div>
            <span className="font-medium">{row.original.name}</span>
            <span className="ml-2 text-sm text-muted-foreground">/{row.original.slug}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'url',
      header: t('url'),
      cell: ({ row }) => (
        <a
          href={row.original.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.url}
          <ExternalLink className="h-3 w-3" />
        </a>
      ),
    },
    {
      id: 'sso',
      header: 'SSO',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.samlEnabled && (
            <Badge variant="secondary" className="gap-0.5 font-normal">
              <Lock className="h-3 w-3" />
              SAML
            </Badge>
          )}
          {row.original.oidcEnabled && (
            <Badge variant="secondary" className="gap-0.5 font-normal">
              <Key className="h-3 w-3" />
              OIDC
            </Badge>
          )}
          {!row.original.samlEnabled && !row.original.oidcEnabled && (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'groupAccess',
      header: t('groupAccess'),
      cell: ({ row }) => (
        <BadgeList
          data={row.original.groupAccess}
          label={(a) => a.group.name}
          emptyMessage={<span className="text-muted-foreground text-sm">Alle</span>}
        />
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('actions')}</span>,
      cell: ({ row }) => (
        <RowActions>
          <EditAction href={`/apps/${row.original.slug}/edit`} title={t('edit')} />
          <DeleteAction onClick={() => setDeleteTarget(row.original)} title={t('delete')} />
        </RowActions>
      ),
      meta: { className: 'text-right' },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={apps}
        emptyMessage={t('noApps')}
        onRowClick={(row) => router.push(`/apps/${row.slug}/edit`)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('deleteConfirm.title')}
        description={
          deleteTarget ? t('deleteConfirm.description', { name: deleteTarget.name }) : ''
        }
        confirmLabel={t('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={() => deleteTarget && deleteAction.execute({ id: deleteTarget.id })}
        isPending={deleteAction.isPending}
      />
    </>
  )
}
