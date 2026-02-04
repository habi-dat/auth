'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { removeMemberAction } from '@/lib/actions/group-actions'
import { Crown, Loader2, UserMinus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'

interface User {
  id: string
  name: string
  email: string
  username: string
}

interface GroupMembersProps {
  group: {
    id: string
    name: string
    memberships: Array<{ user: User }>
    ownerships: Array<{ user: User }>
  }
  canManage: boolean
}

export function GroupMembers({ group, canManage }: GroupMembersProps) {
  const t = useTranslations('groups')
  const tCommon = useTranslations('common')
  const { toast } = useToast()

  const removeMember = useAction(removeMemberAction, {
    onSuccess: () => {
      toast({
        title: t('memberRemoved'),
        description: t('memberRemovedDescription'),
      })
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const ownerIds = new Set(group.ownerships.map((o) => o.user.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('membersCount', { count: group.memberships.length })}</CardTitle>
        <CardDescription>{t('membersDescription', { name: group.name })}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('role')}</TableHead>
              {canManage && <TableHead className="text-right">{t('actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.memberships.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 4 : 3}
                  className="text-center text-muted-foreground py-8"
                >
                  {t('noMembers')}
                </TableCell>
              </TableRow>
            ) : (
              group.memberships.map((membership) => {
                const isOwner = ownerIds.has(membership.user.id)
                return (
                  <TableRow key={membership.user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {membership.user.name}
                        {isOwner && <Crown className="h-4 w-4 text-yellow-500" />}
                      </div>
                    </TableCell>
                    <TableCell>{membership.user.email}</TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Badge variant="default">{t('groupAdmin')}</Badge>
                      ) : (
                        <Badge variant="secondary">{t('member')}</Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            removeMember.execute({
                              groupId: group.id,
                              userId: membership.user.id,
                            })
                          }
                          disabled={removeMember.isPending}
                        >
                          {removeMember.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
