'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import { deleteGroupAction, type getGroups } from '@/lib/actions/group-actions'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, FolderTree, Pencil, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type GroupRow = Awaited<ReturnType<typeof getGroups>>[number]

export function GroupsTable({
  groups,
  isAdmin,
}: {
  groups: GroupRow[]
  isAdmin: boolean
}) {
  const t = useTranslations('groups')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<GroupRow | null>(null)

  const deleteAction = useAction(deleteGroupAction, {
    onSuccess: () => {
      setDeleteTarget(null)
      router.refresh()
    },
  })

  const columns: ColumnDef<GroupRow>[] = [
    {
      accessorKey: 'slug',
      accessorFn: (row) => row.name,
      sortingFn: (rowA, rowB) => rowA.original.slug.localeCompare(rowB.original.slug),
      header: t('name'),
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.isSystem && (
              <Badge variant="outline" className="text-xs">
                {t('system')}
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">@{row.original.slug}</span>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: t('description'),
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block">{row.original.description}</span>
      ),
    },
    {
      id: 'members',
      header: t('members'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{row.original._count.memberships}</span>
        </div>
      ),
    },
    {
      id: 'admins',
      header: t('admins'),
      cell: ({ row }) => {
        const ownerships = row.original.ownerships
        if (ownerships.length === 0) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {ownerships.slice(0, 2).map((o) => (
              <Badge key={o.user.id} variant="secondary" className="gap-0.5 font-normal">
                <ShieldCheck className="h-3 w-3 text-primary" />
                {o.user.name}
              </Badge>
            ))}
            {ownerships.length > 2 && <Badge variant="outline">+{ownerships.length - 2}</Badge>}
          </div>
        )
      },
    },
    {
      id: 'hierarchy',
      header: t('hierarchy'),
      cell: ({ row }) => {
        const g = row.original
        return (
          <div className="flex flex-col gap-1 text-sm">
            {g.parentGroups.length > 0 && (
              <div className="flex items-center gap-1">
                <FolderTree className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {g.parentGroups.map((p) => p.parentGroup.name).join(', ')}
                </span>
              </div>
            )}
            {g.childGroups.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {t('subgroupsCount', { count: g.childGroups.length })}
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('actions')}</span>,
      cell: ({ row }) => {
        const g = row.original
        const canEdit = isAdmin || g.ownerships.length > 0
        return (
          // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Link href={`/groups/${g.id}`}>
              <Button variant="ghost" size="icon" title={canEdit ? t('edit') : t('view')}>
                {canEdit ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </Link>
            {!g.isSystem && (
              <Button
                variant="ghost"
                size="icon"
                title={t('delete')}
                onClick={() => setDeleteTarget(g)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
      meta: { className: 'text-right' },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={groups}
        emptyMessage={t('noGroups')}
        onRowClick={(row) => router.push(`/groups/${row.id}`)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('deleteTitle')}
        description={deleteTarget ? t('deleteDescription', { name: deleteTarget.name }) : ''}
        confirmLabel={t('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={() => deleteTarget && deleteAction.execute({ groupId: deleteTarget.id })}
        isPending={deleteAction.isPending}
      />
    </>
  )
}
