'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  type ImportDiscourseAvatarsResult,
  importDiscourseAvatarsAction,
} from '@/lib/actions/import-discourse-avatars-action'

export function SettingsSyncTab() {
  const t = useTranslations('settings.sync')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const [results, setResults] = useState<ImportDiscourseAvatarsResult | null>(null)

  const importAction = useAction(importDiscourseAvatarsAction, {
    onSuccess: ({ data }) => {
      if (data) setResults(data)
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: t('importFailed'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('importAvatarsHelp')}</p>
          <Button
            type="button"
            onClick={() => importAction.execute({})}
            disabled={importAction.isPending}
          >
            {importAction.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {importAction.isPending ? t('importStarted') : t('importAvatars')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!results} onOpenChange={(open) => !open && setResults(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('resultsTitle')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          {results && (
            <div className="space-y-3 text-sm">
              <p>
                {t('imported')}: <span className="font-medium">{results.imported}</span>
              </p>
              <p>
                {t('skippedHasPicture')}:{' '}
                <span className="font-medium">{results.skippedHasPicture}</span>
              </p>
              <p>
                {t('skippedNoCustom')}:{' '}
                <span className="font-medium">{results.skippedNoCustom}</span>
              </p>
              <div>
                <p>
                  {t('failed')}: <span className="font-medium">{results.failed.length}</span>
                </p>
                {results.failed.length === 0 ? (
                  <p className="text-muted-foreground">{t('noFailures')}</p>
                ) : (
                  <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
                    {results.failed.map((item) => (
                      <li key={`${item.username}-${item.reason}`}>
                        <span className="font-medium">@{item.username}</span>: {item.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setResults(null)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
