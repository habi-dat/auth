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
import { signUp } from '@/lib/auth-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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

export default function RegisterPage() {
  const t = useTranslations('auth.register')
  const tVal = useTranslations('auth.validation')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<number>(0)

  const registerSchema = z
    .object({
      name: z.string().min(2, tVal('nameMin')),
      username: z
        .string()
        .min(3, tVal('usernameMin'))
        .regex(/^[a-zA-Z0-9_-]+$/, tVal('usernameRegex')),
      email: z.string().email(tVal('emailInvalid')),
      password: z.string().min(8, tVal('passwordMin')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: tVal('passwordsMismatch'),
      path: ['confirmPassword'],
    })

  type RegisterForm = z.infer<typeof registerSchema>

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const password = watch('password')

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

  const onSubmit = async (data: RegisterForm) => {
    if (passwordStrength < 3) {
      toast({
        variant: 'destructive',
        title: t('passwordTooWeak'),
        description: t('passwordTooWeakDescription'),
      })
      return
    }

    setIsLoading(true)
    try {
      const result = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
        username: data.username,
      })

      if (result.error) {
        toast({
          variant: 'destructive',
          title: t('failed'),
          description: result.error.message || tCommon('errorGeneric'),
        })
        return
      }

      toast({
        title: t('success'),
        description: t('successDescription'),
      })
      router.push('/login')
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
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              placeholder={t('namePlaceholder')}
              {...register('name')}
              disabled={isLoading}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">{t('username')}</Label>
            <Input
              id="username"
              placeholder={t('usernamePlaceholder')}
              {...register('username')}
              disabled={isLoading}
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              {...register('password', {
                onChange: handlePasswordChange,
              })}
              disabled={isLoading}
            />
            {password && (
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
                  {t('passwordStrength')}: {t(PASSWORD_STRENGTH_KEYS[passwordStrength] ?? '')}
                </p>
              </div>
            )}
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
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
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('submit')}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            {t('hasAccount')}{' '}
            <Link href="/login" className="text-primary hover:underline">
              {t('login')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
