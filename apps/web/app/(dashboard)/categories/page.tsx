import { CategoriesTable } from '@/components/categories/categories-table'
import { ListPageLayout } from '@/components/layout/list-page-layout'
import { Button } from '@/components/ui/button'
import { getCategories } from '@/lib/actions/category-actions'
import { isDiscourseConfigured } from '@/lib/discourse/client'
import { requireAdmin } from '@habidat/auth/session'
import { Loader2, Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Suspense } from 'react'

async function CategoriesTableWrapper() {
  const t = await getTranslations('categories')
  const [categories, configured] = await Promise.all([getCategories(), isDiscourseConfigured()])

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

  return <CategoriesTable categories={categories} emptyMessage={t('empty')} />
}

export default async function CategoriesPage() {
  const t = await getTranslations('categories')
  await requireAdmin()
  const configured = await isDiscourseConfigured()

  return (
    <ListPageLayout
      title={t('title')}
      description={t('description')}
      actions={
        configured ? (
          <Link href="/categories/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('create')}
            </Button>
          </Link>
        ) : undefined
      }
    >
      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <CategoriesTableWrapper />
      </Suspense>
    </ListPageLayout>
  )
}
