'use client'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import type { getInvites, getGroupsForSelect } from '@/lib/actions/invite-actions'
import { deleteInvitesAction } from '@/lib/actions/invite-actions'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Trash2 } from 'lucide-react'

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
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const groupMap = new Map(groups.map((g) => [g.id, g.name]))

  const columns: ColumnDef<InviteRow>[] = [
    {
      accessorKey: 'email',
      header: t('email'),
      cell: ({ row }) => row.original.email,
    },
    {
      id: 'memberGroups',
      header: t('memberGroups'),
      cell: ({ row }) => {
        const ids = row.original.memberGroups.map((m) => m.groupId)
        return ids.map((id) => groupMap.get(id) ?? id).join(', ') || '—'
      },
    },
    {
      id: 'ownerGroups',
      header: t('ownerGroups'),
      cell: ({ row }) => {
        const ids = row.original.ownerGroups.map((o) => o.groupId)
        return ids.map((id) => groupMap.get(id) ?? id).join(', ') || '—'
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
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('delete')}
          onClick={async (e) => {
            e.stopPropagation()
            if (!confirm(`${t('delete')}?`)) return
            setIsDeleting(true)
            const result = await deleteInvitesAction({
              inviteIds: [row.original.id],
            })
            setIsDeleting(false)
            if (result?.data?.success) {
              router.refresh()
            }
            if (result?.serverError) {
              toast({
                title: t('delete'),
                description: result.serverError,
                variant: 'destructive',
              })
            }
          }}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={invites}
      emptyMessage={t('noInvites')}
      searchPlaceholder=""
      pageSize={25}
    />
  )
}
