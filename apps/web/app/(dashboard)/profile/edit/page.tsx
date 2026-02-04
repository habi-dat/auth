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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useSession } from '@/lib/auth-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

export default function EditProfilePage() {
  const t = useTranslations('profile')
  const tVal = useTranslations('auth.validation')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const { data: session, isPending } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const profileSchema = z.object({
    name: z.string().min(2, tVal('nameMin')),
    location: z.string().optional(),
    preferredLanguage: z.string().default('de'),
  })

  type ProfileForm = z.infer<typeof profileSchema>

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      preferredLanguage: 'de',
    },
  })

  const preferredLanguage = watch('preferredLanguage')

  useEffect(() => {
    if (session?.user) {
      const user = session.user as {
        name: string
        email: string
        location?: string
        preferredLanguage?: string
      }
      setValue('name', user.name)
      setValue('location', user.location || '')
      setValue('preferredLanguage', user.preferredLanguage || 'de')
    }
  }, [session, setValue])

  const onSubmit = async (data: ProfileForm) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          location: data.location,
          preferredLanguage: data.preferredLanguage,
        }),
      })

      if (!response.ok) {
        throw new Error('Update failed')
      }

      toast({
        title: t('updated'),
        description: t('updatedDescription'),
      })
      router.push('/')
      router.refresh()
    } catch {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('updateFailed'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{t('editTitle')}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>{t('personalInfo')}</CardTitle>
            <CardDescription>{t('personalInfoDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input id="name" {...register('name')} disabled={isLoading} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={session?.user?.email ?? ''}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">{t('emailNotEditable')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">{t('location')}</Label>
              <Input
                id="location"
                placeholder={t('locationPlaceholder')}
                {...register('location')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">{t('preferredLanguage')}</Label>
              <Select
                value={preferredLanguage}
                onValueChange={(value) => setValue('preferredLanguage', value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">{t('languageDe')}</SelectItem>
                  <SelectItem value="en">{t('languageEn')}</SelectItem>
                </SelectContent>
              </Select>
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
              {tCommon('save')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
