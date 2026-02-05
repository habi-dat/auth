'use client'

import type { DiscourseCategoryApi } from '@habidat/discourse'
import { GroupSelector } from '@/components/groups/group-selector'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  createCategoryAction,
  updateCategoryAction,
} from '@/lib/actions/category-actions'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const categoryFormSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  color: z.string().regex(/^[0-9a-fA-F]{6}$/).optional(),
  text_color: z.string().regex(/^[0-9a-fA-F]{6}$/).optional(),
  parent_category_id: z.number().int().positive().optional().nullable(),
  group_ids: z.array(z.string()).optional(),
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

export type CategoryFormGroup = { id: string; name: string; slug: string }

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: DiscourseCategoryApi[]
  groups: CategoryFormGroup[]
  mode: 'create' | 'edit'
  category?: DiscourseCategoryApi
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  categories,
  groups,
  mode,
  category,
}: CategoryFormDialogProps) {
  const t = useTranslations('categories')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = mode === 'edit'

  const parentOptions = categories.filter(
    (c) => !isEdit || c.id !== category?.id
  )

  const createAction = useAction(createCategoryAction, {
    onSuccess: () => {
      toast({ title: t('created') })
      onOpenChange(false)
      router.refresh()
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
      onOpenChange(false)
      router.refresh()
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError ?? tCommon('errorGeneric'),
      })
    },
  })

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
    if (!open) return
    if (isEdit && category) {
      const groupIds = (category.group_permissions ?? [])
        .map((gp) => groups.find((g) => g.slug === gp.group_name)?.id)
        .filter((id): id is string => !!id)
      form.reset({
        name: category.name,
        slug: category.slug ?? '',
        color: (category.color ?? '0088cc').replace(/^#/, ''),
        text_color: (category.text_color ?? 'ffffff').replace(/^#/, ''),
        parent_category_id: category.parent_category_id ?? null,
        group_ids: groupIds,
      })
    } else {
      form.reset({
        name: '',
        slug: '',
        color: '0088cc',
        text_color: 'ffffff',
        parent_category_id: null,
        group_ids: [],
      })
    }
  }, [open, isEdit, category?.id, category, groups, form.reset])

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset()
    onOpenChange(next)
  }

  const onSubmit = form.handleSubmit((values) => {
    if (isEdit && category) {
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editCategory') : t('newCategory')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder={t('namePlaceholder')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">{t('slug')}</Label>
            <Input
              id="slug"
              {...form.register('slug')}
              placeholder={t('slugPlaceholder')}
            />
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
                    form.setValue(
                      'color',
                      e.target.value.replace(/^#/, ''),
                      { shouldValidate: true }
                    )
                  }
                />
                <Input
                  {...form.register('color')}
                  placeholder="0088cc"
                  className="font-mono"
                />
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
                    form.setValue(
                      'text_color',
                      e.target.value.replace(/^#/, ''),
                      { shouldValidate: true }
                    )
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
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
