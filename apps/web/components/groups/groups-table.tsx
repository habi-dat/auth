'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Eye, FolderTree, ShieldCheck, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import { BadgeList, DeleteAction, EditAction, RowActions } from '@/components/ui/data-table-cells'
import { deleteGroupAction, type getGroups } from '@/lib/actions/group-actions'

type GroupRow = Awaited<ReturnType<typeof getGroups>>[number]

export function GroupsTable({ groups, isAdmin }: { groups: GroupRow[]; isAdmin: boolean }) {
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
      accessorFn: (row) => `${row.name} ${row.slug}`,
      sortingFn: (rowA, rowB) => rowA.original.slug.localeCompare(rowB.original.slug),
      header: t('name'),
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold">{row.original.name}</span>
            {row.original.isSystem && (
              <Badge variant="outline" className="text-xs">
                {t('system')}
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{row.original.slug}</span>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: t('descriptionLabel'),
      cell: ({ row }) => (
        <span className="line-clamp-2  whitespace-normal max-w-[300px]">
          {row.original.description}
        </span>
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
      cell: ({ row }) => (
        <BadgeList
          data={row.original.ownerships}
          label={(o) => (
            <span className="flex items-center gap-0.5">
              <ShieldCheck className="h-3 w-3 text-primary" />
              {o.user.name}
            </span>
          )}
          keyFn={(o) => o.user.id}
          variant="secondary"
          limit={2}
          emptyMessage={<span className="text-muted-foreground text-sm">—</span>}
        />
      ),
    },
    {
      id: 'hierarchy',
      accessorFn: (row) =>
        `${row.parentGroups.map((p) => p.parentGroup.name).join(', ')}-${row.childGroups.length}`,
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
          <RowActions>
            {canEdit ? (
              <EditAction href={`/groups/${g.id}`} title={t('edit')} />
            ) : (
              <Link href={`/groups/${g.id}`}>
                <Button variant="ghost" size="icon" title={t('view')}>
                  <Eye className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {!g.isSystem && <DeleteAction onClick={() => setDeleteTarget(g)} title={t('delete')} />}
          </RowActions>
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
        title={t('deleteConfirm.title')}
        description={
          deleteTarget ? t('deleteConfirm.description', { name: deleteTarget.name }) : ''
        }
        confirmLabel={t('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={() => deleteTarget && deleteAction.execute({ groupId: deleteTarget.id })}
        isPending={deleteAction.isPending}
      />
    </>
  )
}
