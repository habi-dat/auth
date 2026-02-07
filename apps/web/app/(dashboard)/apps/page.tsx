import { requireAdmin } from '@habidat/auth/session'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { AppsTable } from '@/components/apps/apps-table'
import { ListPageLayout } from '@/components/layout/list-page-layout'
import { Button } from '@/components/ui/button'
import { getApps } from '@/lib/actions/app-actions'

async function AppsTableWrapper() {
  const apps = await getApps()
  return <AppsTable apps={apps} />
}

export default async function AppsPage() {
  const t = await getTranslations('apps')
  await requireAdmin()

  return (
    <ListPageLayout
      title={t('title')}
      description={t('description')}
      actions={
        <Link href="/apps/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t('createApp')}
          </Button>
        </Link>
      }
    >
      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <AppsTableWrapper />
      </Suspense>
    </ListPageLayout>
  )
}
