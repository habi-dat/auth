'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import zxcvbn from 'zxcvbn'

const PASSWORD_STRENGTH_KEYS = [
  'passwordStrengthVeryWeak',
  'passwordStrengthWeak',
  'passwordStrengthMedium',
  'passwordStrengthStrong',
  'passwordStrengthVeryStrong',
] as const

export default function ChangePasswordPage() {
  const t = useTranslations('password')
  const tReg = useTranslations('auth.register')
  const tVal = useTranslations('auth.validation')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<number>(0)

  const passwordChangeSchema = z
    .object({
      currentPassword: z.string().min(1, tVal('currentPasswordRequired')),
      newPassword: z.string().min(8, tVal('passwordMin')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: tVal('passwordsMismatch'),
      path: ['confirmPassword'],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: tVal('newPasswordDifferent'),
      path: ['newPassword'],
    })

  type PasswordChangeForm = z.infer<typeof passwordChangeSchema>

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
  })

  const newPassword = watch('newPassword')

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const result = zxcvbn(e.target.value)
    setPasswordStrength(result.score)
  }

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

  const onSubmit = async (data: PasswordChangeForm) => {
    if (passwordStrength < 3) {
      toast({
        variant: 'destructive',
        title: tReg('passwordTooWeak'),
        description: tReg('passwordTooWeakDescription'),
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Password change failed')
      }

      toast({
        title: t('changed'),
        description: t('changedDescription'),
      })
      router.push('/')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('changeFailed'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{t('changeTitle')}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>{t('setNewTitle')}</CardTitle>
            <CardDescription>{t('setNewDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                {...register('currentPassword')}
                disabled={isLoading}
              />
              {errors.currentPassword && (
                <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                {...register('newPassword', {
                  onChange: handlePasswordChange,
                })}
                disabled={isLoading}
              />
              {newPassword && (
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
              )}
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmNewPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link href="/">
              <Button type="button" variant="outline">
                {tCommon('cancel')}
              </Button>
            </Link>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('submit')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
