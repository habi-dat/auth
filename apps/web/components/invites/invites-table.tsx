'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import {
  BadgeList,
  DeleteAction,
  GenericAction,
  RowActions,
} from '@/components/ui/data-table-cells'
import { useToast } from '@/components/ui/use-toast'
import type { getGroupsForSelect, getInvites } from '@/lib/actions/invite-actions'
import { deleteInvitesAction, resendInviteAction } from '@/lib/actions/invite-actions'

type InviteRow = Awaited<ReturnType<typeof getInvites>>[number]
type GroupRow = Awaited<ReturnType<typeof getGroupsForSelect>>[number]

export function InvitesTable({ invites, groups }: { invites: InviteRow[]; groups: GroupRow[] }) {
  const t = useTranslations('invites')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InviteRow | null>(null)

  const groupMap = new Map(groups.map((g) => [g.id, g.name]))

  const columns: ColumnDef<InviteRow>[] = [
    {
      accessorKey: 'email',
      header: t('email'),
      cell: ({ row }) => <span className="font-medium">{row.original.email}</span>,
    },
    {
      id: 'memberGroups',
      header: t('memberGroups'),
      cell: ({ row }) => (
        <BadgeList
          data={row.original.memberGroups}
          label={(m) => groupMap.get(m.groupId) ?? m.groupId}
          keyFn={(m) => m.groupId}
          emptyMessage={<span className="text-muted-foreground text-sm">—</span>}
        />
      ),
    },
    {
      id: 'ownerGroups',
      header: t('ownerGroups'),
      cell: ({ row }) => (
        <BadgeList
          data={row.original.ownerGroups}
          label={(o) => (
            <span className="flex items-center gap-0.5">
              <ShieldCheck className="h-3 w-3" />
              {groupMap.get(o.groupId) ?? o.groupId}
            </span>
          )}
          keyFn={(o) => o.groupId}
          variant="default"
          emptyMessage={<span className="text-muted-foreground text-sm">—</span>}
        />
      ),
    },
    {
      accessorKey: 'expiresAt',
      header: t('expiresAt'),
      cell: ({ row }) =>
        new Date(row.original.expiresAt).toLocaleDateString('de-DE', {
          dateStyle: 'short',
        }),
    },
    {
      id: 'createdBy',
      header: t('createdBy'),
      cell: ({ row }) => row.original.createdBy?.name ?? '—',
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('delete')}</span>,
      cell: ({ row }) => (
        <RowActions>
          <GenericAction
            onClick={async () => {
              setResendingId(row.original.id)
              const result = await resendInviteAction({ inviteId: row.original.id })
              setResendingId(null)
              if (result?.data?.success) {
                toast({
                  title: t('form.resent'),
                  description: result.data.emailSent
                    ? t('form.resentDescription')
                    : t('form.emailNotSent'),
                })
                router.refresh()
              }
              if (result?.serverError) {
                toast({
                  title: tCommon('error'),
                  description: result.serverError,
                  variant: 'destructive',
                })
              }
            }}
            title={t('resend')}
            disabled={resendingId === row.original.id}
            icon={
              <RefreshCw
                className={`h-4 w-4 ${resendingId === row.original.id ? 'animate-spin' : ''}`}
              />
            }
          />
          <DeleteAction
            onClick={() => setDeleteTarget(row.original)}
            title={t('delete')}
            disabled={isDeleting}
          />
        </RowActions>
      ),
      meta: {
        className: 'text-right',
      },
    },
  ]

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    const result = await deleteInvitesAction({
      inviteIds: [deleteTarget.id],
    })
    setIsDeleting(false)
    if (result?.data?.success) {
      setDeleteTarget(null)
      router.refresh()
    }
    if (result?.serverError) {
      toast({
        title: tCommon('error'),
        description: result.serverError,
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <DataTable columns={columns} data={invites} emptyMessage={t('noInvites')} pageSize={25} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('deleteConfirm.title')}
        description={t('deleteConfirm.description', { email: deleteTarget?.email ?? '' })}
        confirmLabel={t('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </>
  )
}
