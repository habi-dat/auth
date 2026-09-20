'use client'

import { signIn } from '@habidat/auth/client'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import zxcvbn from 'zxcvbn'
import {
  AuthCard,
  AuthCardContent,
  AuthCardFooter,
  AuthCardHeader,
} from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { CardDescription, CardTitle } from '@/components/ui/card'
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
import { slugify } from '@/lib/utils'

const PASSWORD_STRENGTH_KEYS = [
  'passwordStrengthVeryWeak',
  'passwordStrengthWeak',
  'passwordStrengthMedium',
  'passwordStrengthStrong',
  'passwordStrengthVeryStrong',
] as const

export default function AcceptInvitePage() {
  const t = useTranslations('acceptInvite')
  const tReg = useTranslations('auth.register')
  const tVal = useTranslations('auth.validation')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const usernameManuallyEdited = useRef(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStrength, setPasswordStrength] = useState(0)
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

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 0:
      case 1:
        return 'bg-destructive'
      case 2:
        return 'bg-yellow-500'
      case 3:
        return 'bg-blue-500'
      case 4:
        return 'bg-green-500'
      default:
        return 'bg-muted'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast({
        title: t('invalidOrExpired'),
        variant: 'destructive',
      })
      return
    }
    if (password !== confirmPassword) {
      toast({
        title: tVal('passwordsMismatch'),
        variant: 'destructive',
      })
      return
    }
    if (passwordStrength < 3) {
      toast({
        variant: 'destructive',
        title: tReg('passwordTooWeak'),
        description: tReg('passwordTooWeakDescription'),
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
    if (result?.serverError) {
      setIsPending(false)
      toast({
        title: t('submit'),
        description: result.serverError,
        variant: 'destructive',
      })
      return
    }
    const email = result?.data?.user?.email
    if (!email) {
      setIsPending(false)
      toast({
        title: t('submit'),
        description: t('signInFailed'),
        variant: 'destructive',
      })
      router.push('/login')
      router.refresh()
      return
    }
    const signInResult = await signIn.email({ email, password })
    setIsPending(false)
    if (signInResult.error) {
      toast({
        title: t('submit'),
        description: t('signInFailed'),
        variant: 'destructive',
      })
      router.push('/login')
      router.refresh()
      return
    }
    toast({
      title: t('submit'),
      description: t('successDescription'),
    })
    router.push('/')
    router.refresh()
  }

  return (
    <AuthCard>
      <AuthCardHeader>
        <CardTitle className="text-2xl font-bold">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </AuthCardHeader>

      <AuthCardContent>
        {!token ? (
          <p className="text-destructive text-sm">{t('invalidOrExpired')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!usernameManuallyEdited.current) {
                    setUsername(slugify(e.target.value))
                  }
                }}
                required
                minLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">{t('username')}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => {
                  usernameManuallyEdited.current = true
                  setUsername(e.target.value)
                }}
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordStrength(zxcvbn(e.target.value).score)
                }}
                required
                minLength={8}
              />
              {password ? (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i < passwordStrength ? getPasswordStrengthColor() : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tReg('passwordStrength')}:{' '}
                    {tReg(PASSWORD_STRENGTH_KEYS[passwordStrength] ?? '')}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
              {confirmPassword && confirmPassword !== password ? (
                <p className="text-sm text-destructive">{tVal('passwordsMismatch')}</p>
              ) : null}
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
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('submit')}
            </Button>
          </form>
        )}
      </AuthCardContent>

      <AuthCardFooter className="max-md:border-0 border-t border-border/60 pt-6">
        <Link href="/login" className="text-sm text-primary hover:underline">
          {t('backToLogin')}
        </Link>
      </AuthCardFooter>
    </AuthCard>
  )
}
