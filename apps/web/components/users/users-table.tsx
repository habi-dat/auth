'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import { deleteUserAction, type getUsers } from '@/lib/actions/user-actions'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type UserRow = Awaited<ReturnType<typeof getUsers>>[number]

export function UsersTable({ users }: { users: UserRow[] }) {
  const t = useTranslations('users')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)

  const deleteAction = useAction(deleteUserAction, {
    onSuccess: () => {
      setDeleteTarget(null)
      router.refresh()
    },
  })

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'name',
      header: t('name'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'email',
      header: t('email'),
      cell: ({ row }) => row.original.email,
    },
    {
      accessorKey: 'username',
      header: t('username'),
      cell: ({ row }) => <span className="text-muted-foreground">@{row.original.username}</span>,
    },
    {
      id: 'groups',
      header: t('groups'),
      cell: ({ row }) => {
        const memberships = row.original.memberships
        return (
          <div className="flex flex-wrap gap-1">
            {memberships.slice(0, 3).map((m) => (
              <Badge key={m.group.id} variant="secondary">
                {m.group.name}
              </Badge>
            ))}
            {memberships.length > 3 && <Badge variant="outline">+{memberships.length - 3}</Badge>}
          </div>
        )
      },
    },
    {
      id: 'groupAdmins',
      header: t('groupAdmins'),
      cell: ({ row }) => {
        const ownerships = row.original.ownerships
        if (ownerships.length === 0) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {ownerships.slice(0, 3).map((o) => (
              <Badge key={o.group.id} variant="default" className="gap-0.5">
                <ShieldCheck className="h-3 w-3" />
                {o.group.name}
              </Badge>
            ))}
            {ownerships.length > 3 && <Badge variant="outline">+{ownerships.length - 3}</Badge>}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('actions')}</span>,
      cell: ({ row }) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link href={`/users/${row.original.id}`}>
            <Button variant="ghost" size="icon" title={t('edit')}>
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            title={t('delete')}
            onClick={() => setDeleteTarget(row.original)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      meta: { className: 'text-right' },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        emptyMessage={t('noUsers')}
        onRowClick={(row) => router.push(`/users/${row.id}`)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('deleteTitle')}
        description={deleteTarget ? t('deleteDescription', { name: deleteTarget.name }) : ''}
        confirmLabel={t('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={() => deleteTarget && deleteAction.execute({ userId: deleteTarget.id })}
        isPending={deleteAction.isPending}
      />
    </>
  )
}
