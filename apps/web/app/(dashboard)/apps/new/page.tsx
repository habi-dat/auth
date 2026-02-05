import { AppForm } from '@/components/apps/app-form'
import { Button } from '@/components/ui/button'
import { getGroups } from '@/lib/actions/group-actions'
import { requireAdmin } from '@/lib/auth/session'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function NewAppPage() {
  const t = await getTranslations('apps')
  await requireAdmin()
  const groups = await getGroups()

  const allGroups = groups.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/apps">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{t('newApp')}</h1>
      </div>
      <AppForm allGroups={allGroups} />
    </div>
  )
}
