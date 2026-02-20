'use client'

import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { getAuditLogs } from '@/lib/audit'

type AuditRow = Awaited<ReturnType<typeof getAuditLogs>>[number]

const actionKeys: Record<AuditRow['action'], string> = {
  CREATE: 'actionCreate',
  UPDATE: 'actionUpdate',
  DELETE: 'actionDelete',
}

const entityTypeKeys: Record<AuditRow['entityType'], string> = {
  USER: 'entityUser',
  GROUP: 'entityGroup',
  INVITE: 'entityInvite',
  APP: 'entityApp',
  CATEGORY: 'entityCategory',
  SETTING: 'entitySetting',
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null
  const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
      <pre className="max-h-48 overflow-auto rounded border bg-muted/50 p-3 font-mono text-xs">
        <code>{str}</code>
      </pre>
    </div>
  )
}

export function AuditDetailsDialog({
  log,
  open,
  onOpenChange,
}: {
  log: AuditRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('audit')

  if (!log) return null

  const hasOld = log.oldValue != null
  const hasNew = log.newValue != null
  const hasMetadata = log.metadata != null
  const hasChanges = hasOld || hasNew || hasMetadata

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('detailsTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('date')}</dt>
            <dd>
              {new Date(log.createdAt).toLocaleString('de-DE', {
                dateStyle: 'medium',
                timeStyle: 'medium',
              })}
            </dd>
            <dt className="text-muted-foreground">{t('actor')}</dt>
            <dd>{log.actor ? (log.actor.name ?? log.actor.email) : t('system')}</dd>
            <dt className="text-muted-foreground">{t('action')}</dt>
            <dd>{t(actionKeys[log.action])}</dd>
            <dt className="text-muted-foreground">{t('entityType')}</dt>
            <dd>{t(entityTypeKeys[log.entityType])}</dd>
            <dt className="text-muted-foreground">{t('entityId')}</dt>
            <dd className="font-mono text-muted-foreground">{log.entityId}</dd>
          </dl>

          {hasChanges ? (
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium">{t('changes')}</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {hasOld && <JsonBlock label={t('before')} value={log.oldValue} />}
                {hasNew && <JsonBlock label={t('after')} value={log.newValue} />}
              </div>
              {hasMetadata && <JsonBlock label={t('metadata')} value={log.metadata} />}
            </div>
          ) : (
            <p className="border-t pt-4 text-muted-foreground text-sm">{t('noChanges')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
