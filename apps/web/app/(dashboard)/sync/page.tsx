import { ListPageLayout } from '@/components/layout/list-page-layout'
import { SyncTable } from '@/components/sync/sync-table'
import { getSyncEvents } from '@/lib/sync/get-sync-events'
import { requireAdmin } from '@/lib/auth/session'
import { Loader2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

async function SyncTableWrapper() {
  const events = await getSyncEvents({ limit: 200 })
  return <SyncTable events={events} />
}

export default async function SyncPage() {
  const t = await getTranslations('sync')
  await requireAdmin()

  return (
    <ListPageLayout title={t('title')} description={t('description')}>
      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <SyncTableWrapper />
      </Suspense>
    </ListPageLayout>
  )
}
