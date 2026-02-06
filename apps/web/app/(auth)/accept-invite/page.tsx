'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { acceptInviteAction, getInviteByToken } from '@/lib/actions/invite-actions'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AcceptInvitePage() {
  const t = useTranslations('acceptInvite')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [primaryGroupId, setPrimaryGroupId] = useState<string | null>(null)
  const [inviteGroups, setInviteGroups] = useState<{ id: string; name: string; slug: string }[]>([])
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (!token.trim()) return
    getInviteByToken(token).then((result) => {
      if (!result) return
      setInviteGroups(result.groups)
      if (result.invite.memberGroups[0]?.groupId) {
        setPrimaryGroupId(result.invite.memberGroups[0].groupId)
      } else if (result.invite.ownerGroups[0]?.groupId) {
        setPrimaryGroupId(result.invite.ownerGroups[0].groupId)
      }
    })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast({
        title: t('invalidOrExpired'),
        variant: 'destructive',
      })
      return
    }
    setIsPending(true)
    const result = await acceptInviteAction({
      token,
      name,
      username,
      password,
      primaryGroupId: primaryGroupId ?? undefined,
    })
    setIsPending(false)
    if (result?.data?.user) {
      toast({
        title: t('submit'),
        description: t('successDescription'),
      })
      router.push('/login')
      router.refresh()
    }
    if (result?.serverError) {
      toast({
        title: t('submit'),
        description: result.serverError,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4">
      <div className="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
        </div>

        {!token ? (
          <p className="text-destructive text-sm">{t('invalidOrExpired')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">{t('username')}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                pattern="^[a-zA-Z0-9_-]+$"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {inviteGroups.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="primaryGroupId">{t('primaryGroup')}</Label>
                <Select
                  value={primaryGroupId ?? ''}
                  onValueChange={(v) => setPrimaryGroupId(v || null)}
                  required={inviteGroups.length > 0}
                >
                  <SelectTrigger id="primaryGroupId">
                    <SelectValue placeholder={t('primaryGroupPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {inviteGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('primaryGroupHint')}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? '…' : t('submit')}
            </Button>
          </form>
        )}

        <div className="text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  )
}
