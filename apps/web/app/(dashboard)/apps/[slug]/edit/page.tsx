import { requireAdmin } from '@habidat/auth/session'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AppForm } from '@/components/apps/app-form'
import { FormPageLayout } from '@/components/layout/form-page-layout'
import { getApps } from '@/lib/actions/app-actions'
import { getGroups as getGroupsList } from '@/lib/actions/group-actions'

export default async function EditAppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const t = await getTranslations('apps')
  await requireAdmin()

  const [apps, groups] = await Promise.all([getApps(), getGroupsList()])
  const app = apps.find((a) => a.slug === slug)
  if (!app) notFound()

  const allGroups = groups.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))

  return (
    <FormPageLayout backHref="/apps" title={t('editApp')}>
      <AppForm app={app} allGroups={allGroups} />
    </FormPageLayout>
  )
}
