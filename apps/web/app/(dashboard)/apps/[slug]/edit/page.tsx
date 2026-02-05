import { AppForm } from '@/components/apps/app-form'
import { Button } from '@/components/ui/button'
import { getApps } from '@/lib/actions/app-actions'
import { getGroups as getGroupsList } from '@/lib/actions/group-actions'
import { requireAdmin } from '@/lib/auth/session'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function EditAppPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const t = await getTranslations('apps')
  await requireAdmin()

  const [apps, groups] = await Promise.all([getApps(), getGroupsList()])
  const app = apps.find((a) => a.slug === slug)
  if (!app) notFound()

  const allGroups = groups.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/apps">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{t('editApp')}</h1>
      </div>
      <AppForm app={app} allGroups={allGroups} />
    </div>
  )
}
