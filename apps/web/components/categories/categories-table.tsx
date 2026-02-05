'use client'

import type { DiscourseCategoryApi } from '@habidat/discourse'
import { CategoryFormDialog, type CategoryFormGroup } from '@/components/categories/category-form-dialog'
import { CategoryDeleteDialog } from '@/components/categories/category-delete-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export function CategoriesTable({
  categories,
  configured,
  groups,
}: {
  categories: DiscourseCategoryApi[] | null
  configured: boolean
  groups: CategoryFormGroup[]
}) {
  const t = useTranslations('categories')
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<DiscourseCategoryApi | null>(null)
  const [deleteCategory, setDeleteCategory] = useState<DiscourseCategoryApi | null>(null)

  if (!configured) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        {t('notConfigured')}
      </div>
    )
  }

  if (categories === null) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        {t('fetchError')}
      </div>
    )
  }

  const parentById = new Map(categories.map((c) => [c.id, c]))
  const sorted = [...categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('create')}
          </Button>
        </div>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('slug')}</TableHead>
                <TableHead>{t('color')}</TableHead>
                <TableHead>{t('parent')}</TableHead>
                <TableHead className="text-right">{t('topics')}</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((cat) => {
                  const parent =
                    cat.parent_category_id != null
                      ? parentById.get(cat.parent_category_id)
                      : null
                  return (
                    <TableRow key={cat.id}>
                      <TableCell>
                        <span className="font-medium">{cat.name}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{cat.slug}</TableCell>
                      <TableCell>
                        <span
                          className="inline-block h-5 w-8 rounded border border-border"
                          style={{
                            backgroundColor: `#${(cat.color ?? '0088cc').replace(/^#/, '')}`,
                          }}
                          title={`#${cat.color ?? '0088cc'}`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {parent ? parent.name : '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {cat.topic_count ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditCategory(cat)}
                            aria-label={t('edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteCategory(cat)}
                            aria-label={t('delete')}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CategoryFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories}
        groups={groups}
        mode="create"
      />
      {editCategory && (
        <CategoryFormDialog
          open={!!editCategory}
          onOpenChange={(open) => !open && setEditCategory(null)}
          categories={categories}
          groups={groups}
          category={editCategory}
          mode="edit"
        />
      )}
      {deleteCategory && (
        <CategoryDeleteDialog
          category={deleteCategory}
          open={!!deleteCategory}
          onOpenChange={(open) => !open && setDeleteCategory(null)}
        />
      )}
    </>
  )
}
