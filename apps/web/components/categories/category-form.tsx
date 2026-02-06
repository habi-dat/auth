'use client'

import { GroupSelector } from '@/components/groups/group-selector'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormFooter } from '@/components/ui/form-footer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from '@/lib/actions/category-actions'
import type { DiscourseCategoryApi } from '@habidat/discourse'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const categoryFormSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  color: z
    .string()
    .regex(/^[0-9a-fA-F]{6}$/)
    .optional(),
  text_color: z
    .string()
    .regex(/^[0-9a-fA-F]{6}$/)
    .optional(),
  parent_category_id: z.number().int().positive().optional().nullable(),
  group_ids: z.array(z.string()).optional(),
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

export type CategoryFormGroup = { id: string; name: string; slug: string }

interface CategoryFormProps {
  category?: DiscourseCategoryApi
  categories: DiscourseCategoryApi[]
  groups: CategoryFormGroup[]
}

export function CategoryForm({ category, categories, groups }: CategoryFormProps) {
  const t = useTranslations('categories')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!category

  const parentOptions = categories.filter((c) => !isEditing || c.id !== category?.id)

  const createAction = useAction(createCategoryAction, {
    onSuccess: () => {
      toast({ title: t('created') })
      router.push('/categories')
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError ?? tCommon('errorGeneric'),
      })
    },
  })

  const updateAction = useAction(updateCategoryAction, {
    onSuccess: () => {
      toast({ title: t('updated') })
      router.push('/categories')
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError ?? tCommon('errorGeneric'),
      })
    },
  })

  const deleteAction = useAction(deleteCategoryAction, {
    onSuccess: () => {
      setDeleteDialogOpen(false)
      toast({ title: t('deleted') })
      router.push('/categories')
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError ?? tCommon('errorGeneric'),
      })
    },
  })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      color: '0088cc',
      text_color: 'ffffff',
      parent_category_id: null,
      group_ids: [],
    },
  })

  useEffect(() => {
    if (category) {
      const groupIds = (category.group_permissions ?? [])
        .map((gp) => groups.find((g) => g.slug === gp.group_name || g.name === gp.group_name)?.id)
        .filter((id): id is string => !!id)
      form.reset({
        name: category.name,
        slug: category.slug ?? '',
        color: (category.color ?? '0088cc').replace(/^#/, ''),
        text_color: (category.text_color ?? 'ffffff').replace(/^#/, ''),
        parent_category_id: category.parent_category_id ?? null,
        group_ids: groupIds,
      })
    }
  }, [category, groups, form])

  const onSubmit = form.handleSubmit((values) => {
    if (isEditing && category) {
      updateAction.execute({
        id: category.id,
        name: values.name,
        slug: values.slug || undefined,
        color: values.color,
        text_color: values.text_color,
        parent_category_id: values.parent_category_id ?? undefined,
        group_ids: values.group_ids,
      })
    } else {
      createAction.execute({
        name: values.name,
        slug: values.slug,
        color: values.color ?? '0088cc',
        text_color: values.text_color ?? 'ffffff',
        parent_category_id: values.parent_category_id ?? undefined,
        group_ids: values.group_ids,
      })
    }
  })

  const isPending = createAction.status === 'executing' || updateAction.status === 'executing'
  const isDeleting = deleteAction.status === 'executing'

  const handleConfirmDelete = () => {
    if (category) deleteAction.execute({ id: category.id })
  }

  return (
    <>
      <Card>
        <form onSubmit={onSubmit}>
          <CardHeader>
            <CardTitle>{isEditing ? t('editCategory') : t('newCategory')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input id="name" {...form.register('name')} placeholder={t('namePlaceholder')} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t('slug')}</Label>
              <Input id="slug" {...form.register('slug')} placeholder={t('slugPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">{t('color')}</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    id="color"
                    className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1"
                    value={`#${form.watch('color') ?? '0088cc'}`}
                    onChange={(e) =>
                      form.setValue('color', e.target.value.replace(/^#/, ''), {
                        shouldValidate: true,
                      })
                    }
                  />
                  <Input {...form.register('color')} placeholder="0088cc" className="font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="text_color">{t('textColor')}</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    id="text_color"
                    className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1"
                    value={`#${form.watch('text_color') ?? 'ffffff'}`}
                    onChange={(e) =>
                      form.setValue('text_color', e.target.value.replace(/^#/, ''), {
                        shouldValidate: true,
                      })
                    }
                  />
                  <Input
                    {...form.register('text_color')}
                    placeholder="ffffff"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('parent')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.watch('parent_category_id') ?? ''}
                onChange={(e) =>
                  form.setValue(
                    'parent_category_id',
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
              >
                <option value="">{t('noParent')}</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <GroupSelector
                groups={groups}
                value={form.watch('group_ids') ?? []}
                onChange={(ids) => form.setValue('group_ids', ids)}
                label={t('groupPermissions')}
                placeholder={t('selectGroupsPlaceholder')}
                searchPlaceholder={t('searchGroups')}
                emptyText={t('noGroupsFound')}
              />
              <p className="text-xs text-muted-foreground">{t('groupPermissionsHint')}</p>
            </div>
          </CardContent>
          <CardFooter>
            <FormFooter
              className="flex-1"
              isLoading={isPending}
              isEditing={isEditing}
              onCancel={() => router.back()}
              onDelete={isEditing && category ? () => setDeleteDialogOpen(true) : undefined}
              deleteLabel={t('delete')}
            />
          </CardFooter>
        </form>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('deleteTitle')}
        description={category ? t('deleteDescription', { name: category.name }) : ''}
        confirmLabel={t('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleConfirmDelete}
        isPending={isDeleting}
      />
    </>
  )
}
