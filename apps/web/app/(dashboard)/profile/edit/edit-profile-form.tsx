'use client'

import type { SessionUser } from '@habidat/auth/session'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FormFooter } from '@/components/ui/form-footer'
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
import { updateProfileAction } from '@/lib/actions/user-actions'

const baseProfileSchema = z.object({
  name: z.string(),
  location: z.string().optional(),
  preferredLanguage: z.string(),
  preferredColorMode: z.enum(['light', 'dark', 'system']),
  primaryGroupId: z.string().optional().nullable(),
})

type ProfileForm = z.infer<typeof baseProfileSchema>

function defaultValuesFromUser(user: SessionUser): ProfileForm {
  return {
    name: user.name,
    location: user.location ?? '',
    preferredLanguage: user.preferredLanguage || 'de',
    preferredColorMode: (user.preferredColorMode as 'light' | 'dark' | 'system') ?? 'system',
    primaryGroupId: user.primaryGroupId ?? null,
  }
}

interface MemberGroup {
  id: string
  name: string
  slug: string
}

interface EditProfileFormProps {
  initialUser: SessionUser
  memberGroups: MemberGroup[]
}

export function EditProfileForm({ initialUser, memberGroups }: EditProfileFormProps) {
  const t = useTranslations('profile')
  const tVal = useTranslations('auth.validation')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const { execute: executeUpdateProfile, status } = useAction(updateProfileAction, {
    onSuccess: () => {
      toast({ title: t('form.updated'), description: t('form.updatedDescription') })
      router.push('/')
      router.refresh()
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('form.updateFailed'),
      })
    },
  })

  const nameRegex = /^[^"(),=`<>]{2,}[^"(),=`<> ]+$/
  const profileSchema = baseProfileSchema.extend({
    name: z.string().min(3, tVal('nameMin')).regex(nameRegex, tVal('nameRegex')),
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaultValuesFromUser(initialUser),
  })

  const preferredLanguage = watch('preferredLanguage')
  const preferredColorMode = watch('preferredColorMode')
  const primaryGroupId = watch('primaryGroupId')

  const onSubmit = (data: ProfileForm) => {
    executeUpdateProfile({
      name: data.name,
      location: data.location ?? null,
      preferredLanguage: data.preferredLanguage,
      preferredColorMode: data.preferredColorMode ?? null,
      primaryGroupId: data.primaryGroupId ?? null,
    })
  }

  const isExecuting = status === 'executing'

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
              <Input id="name" {...register('name')} disabled={isExecuting} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={initialUser.email}
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
                disabled={isExecuting}
              />
            </div>

            {memberGroups.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="primaryGroupId">{t('primaryGroup')}</Label>
                <Select
                  value={primaryGroupId ?? ''}
                  onValueChange={(value) => setValue('primaryGroupId', value || null)}
                  disabled={isExecuting}
                >
                  <SelectTrigger id="primaryGroupId">
                    <SelectValue placeholder={t('primaryGroupPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('primaryGroupNone')}</SelectItem>
                    {memberGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('primaryGroupHint')}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">{t('preferredLanguage')}</Label>
              <Select
                value={preferredLanguage}
                onValueChange={(value) => setValue('preferredLanguage', value)}
                disabled={isExecuting}
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

            <div className="space-y-2">
              <Label htmlFor="preferredColorMode">{t('preferredColorMode')}</Label>
              <Select
                value={preferredColorMode ?? 'system'}
                onValueChange={(value) =>
                  setValue('preferredColorMode', value as 'light' | 'dark' | 'system')
                }
                disabled={isExecuting}
              >
                <SelectTrigger id="preferredColorMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('colorModeLight')}</SelectItem>
                  <SelectItem value="dark">{t('colorModeDark')}</SelectItem>
                  <SelectItem value="system">{t('colorModeSystem')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <FormFooter
              className="flex-1"
              isLoading={isExecuting}
              cancelHref="/"
              isEditing
              onCancel={() => {}} // FormFooter expects onCancel if not cancelHref, though I handled it in component
            />
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
