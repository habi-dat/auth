'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { getSyncEvents } from '@/lib/sync/get-sync-events'
import { useTranslations } from 'next-intl'

type SyncRow = Awaited<ReturnType<typeof getSyncEvents>>[number]

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

export function SyncDetailsDialog({
  event,
  open,
  onOpenChange,
}: {
  event: SyncRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('sync')

  if (!event) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('detailsTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">{t('target')}</span>
            <span>{event.target}</span>
            <span className="text-muted-foreground">{t('operation')}</span>
            <span>{event.operation}</span>
            <span className="text-muted-foreground">{t('entityType')}</span>
            <span>{event.entityType}</span>
            <span className="text-muted-foreground">{t('entityId')}</span>
            <span className="truncate font-mono text-xs" title={event.entityId}>
              {event.entityId}
            </span>
            <span className="text-muted-foreground">{t('status')}</span>
            <span>{event.status}</span>
            <span className="text-muted-foreground">{t('attempts')}</span>
            <span>
              {event.attempts} / {event.maxAttempts}
            </span>
            <span className="text-muted-foreground">{t('createdAt')}</span>
            <span>
              {new Date(event.createdAt).toLocaleString('de-DE', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
            {event.processedAt && (
              <>
                <span className="text-muted-foreground">{t('processedAt')}</span>
                <span>
                  {new Date(event.processedAt).toLocaleString('de-DE', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </>
            )}
          </div>
          <JsonBlock label={t('payload')} value={event.payload} />
          {event.lastError != null && <JsonBlock label={t('lastError')} value={event.lastError} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
