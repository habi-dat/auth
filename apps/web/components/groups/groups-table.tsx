'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import type { getGroups } from '@/lib/actions/group-actions'
import type { ColumnDef } from '@tanstack/react-table'
import { FolderTree, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

type GroupRow = Awaited<ReturnType<typeof getGroups>>[number]

export function GroupsTable({
  groups,
  isAdmin,
}: {
  groups: GroupRow[]
  isAdmin: boolean
}) {
  const t = useTranslations('groups')

  const columns: ColumnDef<GroupRow>[] = [
    {
      id: 'name',
      accessorFn: (row) => row.name,
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
          <Link href={`/groups/${g.id}`}>
            <Button variant="ghost" size="sm">
              {canEdit ? t('edit') : t('view')}
            </Button>
          </Link>
        )
      },
      meta: { className: 'text-right' },
    },
  ]

  return <DataTable columns={columns} data={groups} emptyMessage={t('noGroups')} />
}
