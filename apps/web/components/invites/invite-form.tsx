'use client'

import { GroupSelector } from '@/components/groups/group-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { createInviteAction } from '@/lib/actions/invite-actions'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function InviteForm({
  groups,
}: {
  groups: { id: string; name: string; slug: string }[]
}) {
  const t = useTranslations('invites')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [memberGroupIds, setMemberGroupIds] = useState<string[]>([])
  const [ownerGroupIds, setOwnerGroupIds] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)

  const groupOptions: { id: string; name: string; slug: string }[] = groups

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)
    const result = await createInviteAction({
      email,
      memberGroupIds,
      ownerGroupIds,
    })
    setIsPending(false)
    if (result?.data?.invite) {
      toast({
        title: t('created'),
        description: result.data.emailSent ? t('createdDescription') : t('emailNotSent'),
      })
      router.push('/invites')
      router.refresh()
    }
    if (result?.serverError) {
      toast({
        title: t('createInvite'),
        description: result.serverError,
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>{t('newInvite')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              disabled={isPending}
            />
          </div>
          <GroupSelector
            groups={groupOptions}
            value={memberGroupIds}
            onChange={setMemberGroupIds}
            label={t('memberGroups')}
            placeholder={t('selectGroupsPlaceholder')}
            searchPlaceholder={t('searchGroups')}
            emptyText={t('noGroupsFound')}
            disabled={isPending}
          />
          <GroupSelector
            groups={groupOptions}
            value={ownerGroupIds}
            onChange={setOwnerGroupIds}
            label={t('ownerGroups')}
            placeholder={t('selectGroupsPlaceholder')}
            searchPlaceholder={t('searchGroups')}
            emptyText={t('noGroupsFound')}
            disabled={isPending}
          />
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('createInvite')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
