'use client'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import { BadgeList, DeleteAction, EditAction, RowActions } from '@/components/ui/data-table-cells'
import { deleteUserAction, type getUsers } from '@/lib/actions/user-actions'
import type { ColumnDef } from '@tanstack/react-table'
import { ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
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
      cell: ({ row }) => <BadgeList data={row.original.memberships} label={(m) => m.group.name} />,
    },
    {
      id: 'groupAdmins',
      header: t('groupAdmins'),
      cell: ({ row }) => (
        <BadgeList
          data={row.original.ownerships}
          label={(o) => (
            <span className="flex items-center gap-0.5">
              <ShieldCheck className="h-3 w-3" />
              {o.group.name}
            </span>
          )}
          variant="default"
          emptyMessage={<span className="text-muted-foreground text-sm">—</span>}
        />
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('actions')}</span>,
      cell: ({ row }) => (
        <RowActions>
          <EditAction href={`/users/${row.original.id}`} title={t('edit')} />
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
