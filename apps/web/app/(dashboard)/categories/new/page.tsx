import { CategoryForm } from '@/components/categories/category-form'
import { FormPageLayout } from '@/components/layout/form-page-layout'
import { getCategories } from '@/lib/actions/category-actions'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { requireAdmin } from '@/lib/auth/session'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

export default async function NewCategoryPage() {
  const t = await getTranslations('categories')
  await requireAdmin()

  const [categories, groups] = await Promise.all([
    getCategories(),
    getGroupsForSelect(),
  ])

  if (!categories) {
    notFound()
  }

  return (
    <FormPageLayout backHref="/categories" title={t('newCategory')}>
      <CategoryForm categories={categories} groups={groups} />
    </FormPageLayout>
  )
}
