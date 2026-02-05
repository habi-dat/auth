'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { signIn } from '@/lib/auth-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

interface LoginFormProps {
  platformName?: string
  logoUrl?: string
  logoUpdatedAt?: string
  loginPageText?: string
}

export function LoginForm({
  platformName,
  logoUrl,
  logoUpdatedAt,
  loginPageText,
}: LoginFormProps) {
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

  const logoSrc = logoUrl && logoUpdatedAt ? `${logoUrl}?v=${logoUpdatedAt}` : logoUrl

  return (
    <div className="relative w-full space-y-8">
      {/* Branding */}
      <div className="flex flex-col items-center gap-5 text-center">
        {logoSrc ? (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/60 shadow-inner ring-1 ring-black/5 dark:ring-white/5 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
              className="h-full w-full object-contain"
              width={64}
              height={64}
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {displayName}
          </h1>
          {loginPageText?.trim() ? (
            <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px] mx-auto">
              {loginPageText.trim()}
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-border/60" role="presentation" />

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground/90">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            {...register('email')}
            disabled={isLoading}
            className="h-11"
          />
          {errors.email && (
            <p className="text-destructive text-sm">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-foreground/90">{t('password')}</Label>
            <Link
              href="/forgot-password"
              className="text-muted-foreground text-sm hover:text-primary hover:underline transition-colors"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            disabled={isLoading}
            className="h-11"
          />
          {errors.password && (
            <p className="text-destructive text-sm">{errors.password.message}</p>
          )}
        </div>
        <Button
          type="submit"
          className="w-full h-11 font-semibold shadow-sm"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('submit')}
        </Button>
      </form>
    </div>
  )
}
