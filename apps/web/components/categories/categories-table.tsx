'use client'

import type { DiscourseCategoryApi } from '@habidat/discourse'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { deleteCategoryAction } from '@/lib/actions/category-actions'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CategoriesTable({
  categories,
  emptyMessage,
}: {
  categories: DiscourseCategoryApi[]
  emptyMessage: string
}) {
  const t = useTranslations('categories')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<DiscourseCategoryApi | null>(
    null
  )

  const deleteAction = useAction(deleteCategoryAction, {
    onSuccess: () => {
      setDeleteTarget(null)
      router.refresh()
    },
  })

  const parentById = new Map(categories.map((c) => [c.id, c]))
  const sorted = [...categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const columns: ColumnDef<DiscourseCategoryApi>[] = [
    {
      accessorKey: 'name',
      header: t('name'),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'slug',
      header: t('slug'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.slug}</span>
      ),
    },
    {
      accessorKey: 'color',
      header: t('color'),
      cell: ({ row }) => {
        const color = (row.original.color ?? '0088cc').replace(/^#/, '')
        return (
          <span
            className="inline-block h-5 w-8 rounded border border-border"
            style={{ backgroundColor: `#${color}` }}
            title={`#${color}`}
          />
        )
      },
    },
    {
      id: 'parent',
      accessorFn: (row) => {
        const parent =
          row.parent_category_id != null
            ? parentById.get(row.parent_category_id)
            : null
        return parent?.name ?? '—'
      },
      header: t('parent'),
      cell: ({ row }) => {
        const parent =
          row.original.parent_category_id != null
            ? parentById.get(row.original.parent_category_id)
            : null
        return (
          <span className="text-muted-foreground">
            {parent ? parent.name : '—'}
          </span>
        )
      },
    },
    {
      id: 'groupPermissions',
      accessorFn: (row) => {
        const gp = row.group_permissions
        return gp && gp.length > 0
          ? gp.map((g) => g.group_name).join(', ')
          : '—'
      },
      header: t('groupPermissions'),
      cell: ({ row }) => {
        const gp = row.original.group_permissions
        const text =
          gp && gp.length > 0
            ? gp.map((g) => g.group_name).join(', ')
            : '—'
        return (
          <span
            className="max-w-[200px] truncate block text-muted-foreground"
            title={text !== '—' ? text : undefined}
          >
            {text}
          </span>
        )
      },
    },
    {
      accessorKey: 'topic_count',
      header: () => <span className="text-right block">{t('topics')}</span>,
      cell: ({ row }) => (
        <span className="text-right block text-muted-foreground">
          {row.original.topic_count ?? 0}
        </span>
      ),
      meta: { className: 'text-right' },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('edit')}</span>,
      cell: ({ row }) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Link href={`/categories/${row.original.id}`}>
            <Button variant="ghost" size="icon" title={t('edit')}>
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            title={t('delete')}
            onClick={() => setDeleteTarget(row.original)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      meta: { className: 'text-right' },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={sorted}
        emptyMessage={emptyMessage}
        onRowClick={(row) => router.push(`/categories/${row.id}`)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('deleteTitle')}
        description={
          deleteTarget
            ? t('deleteDescription', { name: deleteTarget.name })
            : ''
        }
        confirmLabel={t('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={() =>
          deleteTarget &&
          deleteAction.execute({ id: deleteTarget.id })
        }
        isPending={deleteAction.isPending}
      />
    </>
  )
}
