'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GroupSelector } from '@/components/groups/group-selector'
import { createInviteAction } from '@/lib/actions/invite-actions'
import { useToast } from '@/components/ui/use-toast'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function InviteForm({
  groups,
}: {
  groups: { id: string; name: string; slug: string }[]
}) {
  const t = useTranslations('invites')
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
        title: result.data.emailSent ? t('created') : t('emailNotSent'),
        description: result.data.emailSent ? t('createdDescription') : undefined,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
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
      />
      <GroupSelector
        groups={groupOptions}
        value={ownerGroupIds}
        onChange={setOwnerGroupIds}
        label={t('ownerGroups')}
        placeholder={t('selectGroupsPlaceholder')}
        searchPlaceholder={t('searchGroups')}
        emptyText={t('noGroupsFound')}
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? '…' : t('createInvite')}
      </Button>
    </form>
  )
}
