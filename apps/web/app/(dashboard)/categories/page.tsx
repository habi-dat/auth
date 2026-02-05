import { CategoriesTable } from '@/components/categories/categories-table'
import { ListPageLayout } from '@/components/layout/list-page-layout'
import { getCategories } from '@/lib/actions/category-actions'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { isDiscourseConfigured } from '@/lib/discourse/client'
import { requireAdmin } from '@/lib/auth/session'
import { Loader2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

async function CategoriesTableWrapper() {
  const [categories, configured, groups] = await Promise.all([
    getCategories(),
    isDiscourseConfigured(),
    getGroupsForSelect(),
  ])
  return (
    <CategoriesTable
      categories={categories}
      configured={configured}
      groups={groups}
    />
  )
}

export default async function CategoriesPage() {
  const t = await getTranslations('categories')
  await requireAdmin()

  return (
    <ListPageLayout
      title={t('title')}
      description={t('description')}
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
