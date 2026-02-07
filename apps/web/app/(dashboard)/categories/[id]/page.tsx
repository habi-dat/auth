import { CategoryForm } from '@/components/categories/category-form'
import { FormPageLayout } from '@/components/layout/form-page-layout'
import { getCategories, getCategory } from '@/lib/actions/category-actions'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { requireAdmin } from '@habidat/auth/session'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditCategoryPage({ params }: PageProps) {
  const { id } = await params
  await requireAdmin()

  const categoryId = Number(id)
  if (!Number.isInteger(categoryId) || categoryId < 1) {
    notFound()
  }

  const [category, categories, groups] = await Promise.all([
    getCategory(categoryId),
    getCategories(),
    getGroupsForSelect(),
  ])

  if (!category || !categories) {
    notFound()
  }

  return (
    <FormPageLayout backHref="/categories" title={category.name} description={category.slug}>
      <CategoryForm category={category} categories={categories} groups={groups} />
    </FormPageLayout>
  )
}
