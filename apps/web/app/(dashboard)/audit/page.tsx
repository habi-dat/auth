import { AuditTable } from '@/components/audit/audit-table'
import { Card, CardContent } from '@/components/ui/card'
import { getAuditLogs } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/session'
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <AuditTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
