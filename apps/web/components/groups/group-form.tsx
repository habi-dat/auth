'use client'

import { GroupSelector } from '@/components/groups/group-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  createGroupAction,
  deleteGroupAction,
  updateGroupAction,
} from '@/lib/actions/group-actions'
import { GROUPADMIN_GROUP_SLUG } from '@/lib/constants'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

interface Group {
  id: string
  name: string
  slug: string
}

interface GroupFormProps {
  group?: {
    id: string
    name: string
    slug: string
    description: string
    isSystem: boolean
    parentGroups: Array<{ parentGroup: Group }>
    childGroups: Array<{ childGroup: Group }>
  }
  allGroups: Group[]
  isAdmin: boolean
}

export function GroupForm({ group, allGroups, isAdmin }: GroupFormProps) {
  const t = useTranslations('groups')
  const tVal = useTranslations('groups.validation')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const isEditing = !!group

  const createGroupSchema = z.object({
    name: z.string().min(3, tVal('nameMin')),
    slug: z
      .string()
      .min(3, tVal('slugMin'))
      .regex(/^[a-zA-Z0-9_-]+$/, tVal('slugRegex')),
    description: z.string().min(1, tVal('descriptionRequired')),
    parentGroupIds: z.array(z.string()).optional(),
    childGroupIds: z.array(z.string()).optional(),
  })

  const updateGroupSchema = z.object({
    id: z.string(),
    name: z.string().min(3, tVal('nameMin')),
    description: z.string().min(1, tVal('descriptionRequired')),
    parentGroupIds: z.array(z.string()).optional(),
    childGroupIds: z.array(z.string()).optional(),
  })

  type CreateGroupForm = z.infer<typeof createGroupSchema>
  type UpdateGroupForm = z.infer<typeof updateGroupSchema>

  // groupadmin system group cannot be used as parent or child of another group
  const availableGroups = allGroups.filter(
    (g) => g.id !== group?.id && g.slug !== GROUPADMIN_GROUP_SLUG
  )

  const createAction = useAction(createGroupAction, {
    onSuccess: () => {
      toast({ title: t('created'), description: t('createdDescription') })
      router.push('/groups')
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const updateAction = useAction(updateGroupAction, {
    onSuccess: () => {
      toast({ title: t('updated'), description: t('updatedDescription') })
      router.push('/groups')
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const deleteAction = useAction(deleteGroupAction, {
    onSuccess: () => {
      toast({ title: t('deleted'), description: t('deletedDescription') })
      router.push('/groups')
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
  } = useForm<CreateGroupForm | UpdateGroupForm>({
    resolver: zodResolver(isEditing ? updateGroupSchema : createGroupSchema),
    defaultValues: isEditing
      ? {
          id: group.id,
          name: group.name,
          description: group.description,
          parentGroupIds: group.parentGroups
            .filter((p) => p.parentGroup.slug !== GROUPADMIN_GROUP_SLUG)
            .map((p) => p.parentGroup.id),
          childGroupIds: group.childGroups
            .filter((c) => c.childGroup.slug !== GROUPADMIN_GROUP_SLUG)
            .map((c) => c.childGroup.id),
        }
      : {
          name: '',
          slug: '',
          description: '',
          parentGroupIds: [],
          childGroupIds: [],
        },
  })

  const onSubmit = async (data: CreateGroupForm | UpdateGroupForm) => {
    if (isEditing) {
      updateAction.execute(data as UpdateGroupForm)
    } else {
      createAction.execute(data as CreateGroupForm)
    }
  }

  const isLoading =
    createAction.isPending ||
    updateAction.isPending ||
    deleteAction.isPending
  const isSystemGroup = group?.isSystem

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>{isEditing ? t('editGroup') : t('newGroupForm')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input id="name" {...register('name')} disabled={isLoading || isSystemGroup} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="slug">{t('slugLabel')}</Label>
              <Input
                id="slug"
                {...register('slug' as keyof (CreateGroupForm | UpdateGroupForm))}
                disabled={isLoading}
                placeholder={t('slugPlaceholder')}
              />
              {'slug' in errors && errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea
              id="description"
              {...register('description')}
              disabled={isLoading || isSystemGroup}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {isAdmin && availableGroups.length > 0 && (
            <>
              <GroupSelector
                groups={availableGroups}
                value={watch('parentGroupIds') || []}
                onChange={(ids) => setValue('parentGroupIds', ids)}
                label={t('parentGroups')}
                placeholder={t('selectGroupsPlaceholder')}
                searchPlaceholder={t('searchGroups')}
                emptyText={t('noGroupsFound')}
                disabled={isLoading}
                excludeGroupIds={[]}
              />
              <p className="text-xs text-muted-foreground -mt-1">{t('parentGroupsHint')}</p>

              <GroupSelector
                groups={availableGroups}
                value={watch('childGroupIds') || []}
                onChange={(ids) => setValue('childGroupIds', ids)}
                label={t('childGroups')}
                placeholder={t('selectGroupsPlaceholder')}
                searchPlaceholder={t('searchGroups')}
                emptyText={t('noGroupsFound')}
                disabled={isLoading}
                excludeGroupIds={[]}
              />
              <p className="text-xs text-muted-foreground -mt-1">{t('childGroupsHint')}</p>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            {isEditing && !isSystemGroup && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isLoading}
              >
                {t('delete')}
              </Button>
            )}
          </div>
          <Button type="submit" disabled={isLoading || isSystemGroup}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? tCommon('save') : tCommon('create')}
          </Button>
        </CardFooter>
      </form>
      {isEditing && !isSystemGroup && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t('deleteTitle')}
          description={
            group ? t('deleteDescription', { name: group.name }) : ''
          }
          confirmLabel={t('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => deleteAction.execute({ groupId: group!.id })}
          isPending={deleteAction.isPending}
        />
      )}
    </Card>
  )
}
