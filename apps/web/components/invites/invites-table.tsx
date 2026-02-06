'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import { useToast } from '@/components/ui/use-toast'
import type { getGroupsForSelect, getInvites } from '@/lib/actions/invite-actions'
import { deleteInvitesAction, resendInviteAction } from '@/lib/actions/invite-actions'
import type { ColumnDef } from '@tanstack/react-table'
import { RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type InviteRow = Awaited<ReturnType<typeof getInvites>>[number]
type GroupRow = Awaited<ReturnType<typeof getGroupsForSelect>>[number]

export function InvitesTable({
  invites,
  groups,
}: {
  invites: InviteRow[]
  groups: GroupRow[]
}) {
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
      cell: ({ row }) => {
        const ids = row.original.memberGroups.map((m) => m.groupId)
        if (ids.length === 0) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {ids.slice(0, 3).map((id) => (
              <Badge key={id} variant="secondary">
                {groupMap.get(id) ?? id}
              </Badge>
            ))}
            {ids.length > 3 && <Badge variant="outline">+{ids.length - 3}</Badge>}
          </div>
        )
      },
    },
    {
      id: 'ownerGroups',
      header: t('ownerGroups'),
      cell: ({ row }) => {
        const ids = row.original.ownerGroups.map((o) => o.groupId)
        if (ids.length === 0) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {ids.slice(0, 3).map((id) => (
              <Badge key={id} variant="default" className="gap-0.5">
                <ShieldCheck className="h-3 w-3" />
                {groupMap.get(id) ?? id}
              </Badge>
            ))}
            {ids.length > 3 && <Badge variant="outline">+{ids.length - 3}</Badge>}
          </div>
        )
      },
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
        // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            title={t('resend')}
            disabled={resendingId === row.original.id}
            onClick={async () => {
              setResendingId(row.original.id)
              const result = await resendInviteAction({ inviteId: row.original.id })
              setResendingId(null)
              if (result?.data?.success) {
                toast({
                  title: t('resent'),
                  description: result.data.emailSent ? t('resentDescription') : t('emailNotSent'),
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
          >
            <RefreshCw
              className={`h-4 w-4 ${resendingId === row.original.id ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={t('delete')}
            onClick={() => setDeleteTarget(row.original)}
            disabled={isDeleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      meta: { className: 'text-right' },
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
        title={t('deleteTitle')}
        description={t('deleteDescription', { email: deleteTarget?.email ?? '' })}
        confirmLabel={t('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </>
  )
}
