'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { useToast } from '@/components/ui/use-toast'
import { UserSelector } from '@/components/users/user-selector'
import {
  addMemberAction,
  addOwnerAction,
  removeMemberAction,
  removeOwnerAction,
} from '@/lib/actions/group-actions'
import type { ColumnDef } from '@tanstack/react-table'
import { Crown, Loader2, UserMinus, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface User {
  id: string
  name: string
  email: string
  username?: string
}

interface UserOption {
  id: string
  name: string
  email: string
}

type MemberRow = { user: User }

interface GroupMembersProps {
  group: {
    id: string
    name: string
    memberships: Array<{ user: User }>
    ownerships: Array<{ user: User }>
  }
  users: UserOption[]
  canManage: boolean
}

export function GroupMembers({ group, users, canManage }: GroupMembersProps) {
  const t = useTranslations('groups')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const router = useRouter()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const memberIds = new Set(group.memberships.map((m) => m.user.id))
  const ownerIds = new Set(group.ownerships.map((o) => o.user.id))

  const addMember = useAction(addMemberAction, {
    onSuccess: () => {
      toast({
        title: t('memberAdded'),
        description: t('memberAddedDescription'),
      })
      setSelectedUserId(null)
      router.refresh()
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const removeMember = useAction(removeMemberAction, {
    onSuccess: () => {
      toast({
        title: t('memberRemoved'),
        description: t('memberRemovedDescription'),
      })
      router.refresh()
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const addOwner = useAction(addOwnerAction, {
    onSuccess: () => {
      toast({
        title: t('ownerAdded'),
        description: t('ownerAddedDescription'),
      })
      router.refresh()
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const removeOwner = useAction(removeOwnerAction, {
    onSuccess: () => {
      toast({
        title: t('ownerRemoved'),
        description: t('ownerRemovedDescription'),
      })
      router.refresh()
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const handleAddMember = () => {
    if (!selectedUserId) return
    addMember.execute({ groupId: group.id, userId: selectedUserId })
  }

  const columns = useMemo<ColumnDef<MemberRow>[]>(() => {
    const base: ColumnDef<MemberRow>[] = [
      {
        id: 'name',
        accessorFn: (row) => row.user.name,
        header: t('name'),
        cell: ({ row }) => {
          const isOwner = ownerIds.has(row.original.user.id)
          return (
            <div className="flex items-center gap-2 font-medium">
              {row.original.user.name}
              {isOwner && <Crown className="h-4 w-4 text-yellow-500" />}
            </div>
          )
        },
      },
      {
        id: 'email',
        accessorFn: (row) => row.user.email,
        header: t('email'),
        cell: ({ row }) => row.original.user.email,
      },
      {
        id: 'role',
        header: t('role'),
        cell: ({ row }) => {
          const isOwner = ownerIds.has(row.original.user.id)
          return isOwner ? (
            <Badge variant="default">{t('groupAdmin')}</Badge>
          ) : (
            <Badge variant="secondary">{t('member')}</Badge>
          )
        },
      },
    ]
    if (canManage) {
      base.push({
        id: 'actions',
        header: () => <span className="sr-only">{t('actions')}</span>,
        cell: ({ row }) => {
          const userId = row.original.user.id
          const isOwner = ownerIds.has(userId)
          return (
            <div className="flex items-center justify-end gap-1">
              {isOwner ? (
                <Button
                  variant="ghost"
                  size="sm"
                  title={t('removeAdmin')}
                  onClick={() => removeOwner.execute({ groupId: group.id, userId })}
                  disabled={removeOwner.isPending}
                >
                  {removeOwner.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crown className="h-4 w-4 text-yellow-500" />
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  title={t('makeAdmin')}
                  onClick={() => addOwner.execute({ groupId: group.id, userId })}
                  disabled={addOwner.isPending}
                >
                  {addOwner.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crown className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                title={t('memberRemoved')}
                onClick={() => removeMember.execute({ groupId: group.id, userId })}
                disabled={removeMember.isPending}
              >
                {removeMember.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserMinus className="h-4 w-4" />
                )}
              </Button>
            </div>
          )
        },
        meta: { className: 'text-right' },
      })
    }
    return base
  }, [t, canManage, ownerIds, group.id, addOwner, removeOwner, removeMember])

  const data = group.memberships

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('membersCount', { count: group.memberships.length })}</CardTitle>
        <CardDescription>{t('membersDescription', { name: group.name })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {canManage && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <UserSelector
              users={users}
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder={t('addMemberPlaceholder')}
              searchPlaceholder={t('searchUsers')}
              emptyText={t('noUsersFound')}
              excludeUserIds={Array.from(memberIds)}
              className="flex-1"
            />
            <Button onClick={handleAddMember} disabled={!selectedUserId || addMember.isPending}>
              {addMember.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t('addMember')}
                </>
              )}
            </Button>
          </div>
        )}

        <DataTable columns={columns} data={data} emptyMessage={t('noMembers')} />
      </CardContent>
    </Card>
  )
}
