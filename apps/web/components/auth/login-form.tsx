'use client'

import { signIn } from '@habidat/auth/client'
import { STAY_LOGGED_IN_HEADER, STAY_LOGGED_IN_STORAGE_KEY } from '@habidat/auth/session-lifetime'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { resolveLoginEmail } from '@/lib/actions/auth-actions'
import { isAllowedCallbackUrl, resolvePostLoginHref } from '@/lib/auth/post-login-redirect'

export function LoginForm() {
  const t = useTranslations('auth.login')
  const tVal = useTranslations('auth.validation')
  const tCommon = useTranslations('common')

  const loginSchema = z.object({
    identity: z.string().min(1, tVal('identityRequired')),
    password: z.string().min(1, tVal('passwordRequired')),
  })

  type LoginFormValues = z.infer<typeof loginSchema>
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [stayLoggedIn, setStayLoggedIn] = useState(false)

  useEffect(() => {
    try {
      setStayLoggedIn(window.localStorage.getItem(STAY_LOGGED_IN_STORAGE_KEY) === '1')
    } catch {
      // Private browsing can block storage. The checkbox stays unchecked.
    }
  }, [])

  const onStayLoggedInChange = (checked: boolean) => {
    setStayLoggedIn(checked)
    try {
      window.localStorage.setItem(STAY_LOGGED_IN_STORAGE_KEY, checked ? '1' : '0')
    } catch {
      // The choice still applies to this login if storage is unavailable.
    }
  }

  const returnTo = searchParams.get('returnTo') || '/'
  const callbackUrl = searchParams.get('callbackUrl') // OIDC interaction return URL
  const samlApp = searchParams.get('samlApp')
  const samlRequest = searchParams.get('SAMLRequest')
  const relayState = searchParams.get('RelayState')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true)
    try {
      let email = data.identity.trim()
      if (!email.includes('@')) {
        const result = await resolveLoginEmail(email)
        if (result.email) {
          email = result.email
        } else {
          const suggestions = 'suggestedUsernames' in result ? result.suggestedUsernames : undefined
          toast({
            variant: 'destructive',
            title: t('failed'),
            description: suggestions?.length
              ? t('nameSuggestion', { usernames: suggestions.join(', ') })
              : t('invalidCredentials'),
            duration: 10000,
          })
          return
        }
      }

      const result = await signIn.email(
        {
          email,
          password: data.password,
          rememberMe: true,
        },
        stayLoggedIn ? { headers: { [STAY_LOGGED_IN_HEADER]: '1' } } : undefined
      )

      if (result.error) {
        toast({
          variant: 'destructive',
          title: t('failed'),
          description: t('invalidCredentials'),
        })
        return
      }

      if (samlApp) {
        const ssoUrl = new URL(`/sso/login/${samlApp}`, window.location.origin)
        if (samlRequest) ssoUrl.searchParams.set('SAMLRequest', samlRequest)
        if (relayState) ssoUrl.searchParams.set('RelayState', relayState)
        router.push(ssoUrl.pathname + ssoUrl.search)
        router.refresh()
        return
      }

      const nextHref = resolvePostLoginHref(returnTo, callbackUrl, window.location.origin)
      // OIDC must be a full browser navigation. A client-side Next.js
      // navigation fetches the one-time interaction as RSC, consumes it, and
      // the following document load then fails with "interaction session not found".
      if (isAllowedCallbackUrl(nextHref, window.location.origin)) {
        window.location.assign(nextHref)
        return
      }
      router.push(nextHref)
      router.refresh()
    } catch {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: tCommon('errorGeneric'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="identity" className="text-foreground/90">
            {t('identity')}
          </Label>
          <Input
            id="identity"
            type="text"
            autoComplete="username"
            {...register('identity')}
            disabled={isLoading}
            className="h-11"
          />
          {errors.identity && <p className="text-destructive text-sm">{errors.identity.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-foreground/90">
            {t('password')}
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            disabled={isLoading}
            className="h-11"
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-muted-foreground text-sm hover:text-primary hover:underline transition-colors"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="stayLoggedIn"
            checked={stayLoggedIn}
            onCheckedChange={(checked) => onStayLoggedInChange(checked === true)}
            disabled={isLoading}
          />
          <Label htmlFor="stayLoggedIn" className="cursor-pointer font-normal text-foreground/90">
            {t('stayLoggedIn')}
          </Label>
        </div>
        <Button type="submit" className="w-full h-11 font-semibold shadow-sm" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('submit')}
        </Button>
      </form>
    </div>
  )
}
