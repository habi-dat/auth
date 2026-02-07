import { AuditTable } from '@/components/audit/audit-table'
import { ListPageLayout } from '@/components/layout/list-page-layout'
import { getAuditLogs } from '@/lib/audit'
import { requireAdmin } from '@habidat/auth/session'
import { Loader2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

async function AuditTableWrapper() {
  const logs = await getAuditLogs()
  return <AuditTable logs={logs} />
}

export default async function AuditPage() {
  const t = await getTranslations('audit')
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
        <AuditTableWrapper />
      </Suspense>
    </ListPageLayout>
  )
}
