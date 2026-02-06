import { AppForm } from '@/components/apps/app-form'
import { FormPageLayout } from '@/components/layout/form-page-layout'
import { getGroups } from '@/lib/actions/group-actions'
import { requireAdmin } from '@/lib/auth/session'
import { getTranslations } from 'next-intl/server'

export default async function NewAppPage() {
  const t = await getTranslations('apps')
  await requireAdmin()
  const groups = await getGroups()

  const allGroups = groups.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))

  return (
    <FormPageLayout backHref="/apps" title={t('newApp')}>
      <AppForm allGroups={allGroups} />
    </FormPageLayout>
  )
}
