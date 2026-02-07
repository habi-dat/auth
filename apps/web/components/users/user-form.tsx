'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import zxcvbn from 'zxcvbn'
import { GroupSelector } from '@/components/groups/group-selector'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { createUserAction, deleteUserAction, updateUserAction } from '@/lib/actions/user-actions'
import { GROUPADMIN_GROUP_SLUG } from '@/lib/constants'

interface GroupWithSlug {
  id: string
  name: string
  slug: string
}

interface UserFormProps {
  user?: {
    id: string
    name: string
    email: string
    username: string
    location: string | null
    preferredLanguage: string
    storageQuota: string
    primaryGroupId: string | null
    memberships: Array<{ group: GroupWithSlug }>
    ownerships: Array<{ group: GroupWithSlug }>
  }
  groups: GroupWithSlug[]
}

export function UserForm({ user, groups }: UserFormProps) {
  const t = useTranslations('users')
  const tVal = useTranslations('auth.validation')
  const tCommon = useTranslations('common')
  const tReg = useTranslations('auth.register')
  const router = useRouter()
  const { toast } = useToast()
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const isEditing = !!user

  const createUserSchema = z.object({
    name: z.string().min(2, tVal('nameMin')),
    username: z
      .string()
      .min(3, tVal('usernameMin'))
      .regex(/^[a-zA-Z0-9_-]+$/, tVal('usernameRegex')),
    email: z.string().email(tVal('emailInvalid')),
    password: z.string().min(8, tVal('passwordMin')),
    location: z.string().optional(),
    preferredLanguage: z.string().default('de'),
    storageQuota: z.string().default('1 GB'),
    memberGroupIds: z.array(z.string()),
    ownerGroupIds: z.array(z.string()).optional(),
    primaryGroupId: z.string().optional().nullable(),
  })

  const updateUserSchema = z.object({
    id: z.string(),
    name: z.string().min(2, tVal('nameMin')),
    email: z.string().email(tVal('emailInvalid')),
    location: z.string().optional().nullable(),
    preferredLanguage: z.string(),
    storageQuota: z.string(),
    memberGroupIds: z.array(z.string()),
    ownerGroupIds: z.array(z.string()).optional(),
    primaryGroupId: z.string().optional().nullable(),
  })

  type CreateUserForm = z.infer<typeof createUserSchema>
  type UpdateUserForm = z.infer<typeof updateUserSchema>

  const createAction = useAction(createUserAction, {
    onSuccess: () => {
      toast({ title: t('created'), description: t('createdDescription') })
      router.push('/users')
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const updateAction = useAction(updateUserAction, {
    onSuccess: () => {
      toast({ title: t('updated'), description: t('updatedDescription') })
      router.push('/users')
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const deleteAction = useAction(deleteUserAction, {
    onSuccess: () => {
      toast({ title: t('deleted'), description: t('deletedDescription') })
      router.push('/users')
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateUserForm | UpdateUserForm>({
    // biome-ignore lint/suspicious/noExplicitAny: too complex to fix
    resolver: zodResolver(isEditing ? updateUserSchema : createUserSchema) as any,
    defaultValues: isEditing
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          location: user.location || '',
          preferredLanguage: user.preferredLanguage,
          storageQuota: user.storageQuota,
          memberGroupIds: user.memberships
            .filter((m) => m.group.slug !== GROUPADMIN_GROUP_SLUG)
            .map((m) => m.group.id),
          ownerGroupIds: user.ownerships
            .filter((o) => o.group.slug !== GROUPADMIN_GROUP_SLUG)
            .map((o) => o.group.id),
          primaryGroupId: user.primaryGroupId ?? null,
        }
      : {
          name: '',
          username: '',
          email: '',
          password: '',
          location: '',
          preferredLanguage: 'de',
          storageQuota: '1 GB',
          memberGroupIds: [],
          ownerGroupIds: [],
          primaryGroupId: null,
        },
  })

  const password = watch('password' as keyof (CreateUserForm | UpdateUserForm))
  const preferredLanguage = watch('preferredLanguage')
  const storageQuota = watch('storageQuota')
  const memberGroupIds = watch('memberGroupIds') || []
  const primaryGroupId = watch('primaryGroupId')

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

  const onSubmit = async (data: CreateUserForm | UpdateUserForm) => {
    if (!isEditing && 'password' in data && passwordStrength < 3) {
      toast({
        variant: 'destructive',
        title: tReg('passwordTooWeak'),
        description: tReg('passwordTooWeakDescription'),
      })
      return
    }

    if (isEditing) {
      updateAction.execute(data as UpdateUserForm)
    } else {
      createAction.execute(data as CreateUserForm)
    }
  }

  const isLoading = createAction.isPending || updateAction.isPending || deleteAction.isPending
  // groupadmin system group cannot be assigned/removed on user form (membership is automatic)
  const selectableGroups = groups.filter((g) => g.slug !== GROUPADMIN_GROUP_SLUG)
  const primaryGroupOptions = selectableGroups.filter((g) => memberGroupIds.includes(g.id))
  useEffect(() => {
    if (primaryGroupId == null) return
    const valid = memberGroupIds.includes(primaryGroupId)
    if (!valid) {
      setValue('primaryGroupId', memberGroupIds[0] ?? null)
    }
  }, [memberGroupIds, primaryGroupId, setValue])

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>{isEditing ? t('userFormEditTitle') : t('userFormTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input id="name" {...register('name')} disabled={isLoading} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="username">{t('username')}</Label>
                <Input
                  id="username"
                  {...register('username' as keyof (CreateUserForm | UpdateUserForm))}
                  disabled={isLoading}
                />
                {'username' in errors && errors.username && (
                  <p className="text-sm text-destructive">{errors.username.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" {...register('email')} disabled={isLoading} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="password">{tReg('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password' as keyof (CreateUserForm | UpdateUserForm), {
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
                  </div>
                )}
                {'password' in errors && errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="location">{t('location')}</Label>
              <Input id="location" {...register('location')} disabled={isLoading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">{t('language')}</Label>
              <Select
                value={preferredLanguage}
                onValueChange={(v) => setValue('preferredLanguage', v)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storageQuota">{t('storageQuota')}</Label>
              <Select
                value={storageQuota}
                onValueChange={(v) => setValue('storageQuota', v)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1 GB">1 GB</SelectItem>
                  <SelectItem value="5 GB">5 GB</SelectItem>
                  <SelectItem value="10 GB">10 GB</SelectItem>
                  <SelectItem value="50 GB">50 GB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <GroupSelector
            groups={selectableGroups}
            value={watch('memberGroupIds') || []}
            onChange={(ids) => setValue('memberGroupIds', ids)}
            label={t('groupMemberships')}
            placeholder={t('selectGroupsPlaceholder')}
            searchPlaceholder={t('searchGroups')}
            emptyText={t('noGroupsFound')}
            disabled={isLoading}
          />
          <GroupSelector
            groups={selectableGroups}
            value={watch('ownerGroupIds') || []}
            onChange={(ids) => setValue('ownerGroupIds', ids)}
            label={t('groupOwnership')}
            placeholder={t('selectGroupsPlaceholder')}
            searchPlaceholder={t('searchGroups')}
            emptyText={t('noGroupsFound')}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground -mt-2">{t('groupOwnershipHint')}</p>
          {primaryGroupOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="primaryGroupId">{t('primaryGroup')}</Label>
              <Select
                value={primaryGroupId ?? ''}
                onValueChange={(v) => setValue('primaryGroupId', v || null)}
                disabled={isLoading}
              >
                <SelectTrigger id="primaryGroupId">
                  <SelectValue placeholder={t('primaryGroupPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('primaryGroupNone')}</SelectItem>
                  {primaryGroupOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('primaryGroupHint')}</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <FormFooter
            className="flex-1"
            isLoading={isLoading}
            isEditing={isEditing}
            onCancel={() => router.back()}
            onDelete={isEditing ? () => setDeleteDialogOpen(true) : undefined}
            deleteLabel={t('delete')}
          />
        </CardFooter>
      </form>
      {isEditing && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t('deleteTitle')}
          description={user ? t('deleteDescription', { name: user.name }) : ''}
          confirmLabel={t('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => deleteAction.execute({ userId: user!.id })}
          isPending={deleteAction.isPending}
        />
      )}
    </Card>
  )
}
