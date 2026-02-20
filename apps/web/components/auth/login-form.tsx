'use client'

import { signIn } from '@habidat/auth/client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

interface LoginFormProps {
  platformName?: string
  loginPageText?: string
}

export function LoginForm({ platformName, loginPageText }: LoginFormProps) {
  const t = useTranslations('auth.login')
  const tVal = useTranslations('auth.validation')
  const tCommon = useTranslations('common')

  const loginSchema = z.object({
    email: z.string().email(tVal('emailInvalid')),
    password: z.string().min(1, tVal('passwordRequired')),
  })

  type LoginFormValues = z.infer<typeof loginSchema>
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const returnTo = searchParams.get('returnTo') || '/'
  const callbackUrl = searchParams.get('callbackUrl') // OIDC interaction return URL
  const samlApp = searchParams.get('samlApp')
  const samlRequest = searchParams.get('SAMLRequest')
  const relayState = searchParams.get('RelayState')
  const displayName = platformName?.trim() || t('title')

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
      const result = await signIn.email({
        email: data.email,
        password: data.password,
      })

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
      } else if (callbackUrl) {
        router.push(callbackUrl)
      } else {
        router.push(returnTo)
      }
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
    <div className="relative w-full space-y-8">
      {/* Title / intro inside card */}
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground px-12">{displayName}</h1>
          {loginPageText?.trim() ? (
            <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px] mx-auto">
              {loginPageText.trim()}
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-border/60" role="presentation" />

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground/90">
            {t('email')}
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            {...register('email')}
            disabled={isLoading}
            className="h-11"
          />
          {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
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
        <Button type="submit" className="w-full h-11 font-semibold shadow-sm" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('submit')}
        </Button>
      </form>
    </div>
  )
}
