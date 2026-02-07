'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  getEmailPreviewHtmlAction,
  updateEmailTemplateAction,
} from '@/lib/actions/email-template-actions'
import type {
  EmailTemplateKey,
  SingleLocaleEmailConfig,
  SupportedEmailLocale,
} from '@/lib/email/types'
import { SUPPORTED_EMAIL_LOCALES } from '@/lib/email/types'
import { useToast } from '@/components/ui/use-toast'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface EmailTemplateFormProps {
  templateKey: EmailTemplateKey
  templateKeyLabel: string
  initialConfigByLocale: Record<string, SingleLocaleEmailConfig>
  defaultCopyByLocale: Record<string, Record<string, string>>
  initialEnabled: boolean
}

function getLocaleLabel(locale: string, t: (key: string) => string): string {
  if (locale === 'de') return t('localeDe')
  if (locale === 'en') return t('localeEn')
  return locale
}

export function EmailTemplateForm({
  templateKey,
  templateKeyLabel,
  initialConfigByLocale,
  defaultCopyByLocale,
  initialEnabled,
}: EmailTemplateFormProps) {
  const t = useTranslations('settings.templates')
  const [activeLocale, setActiveLocale] = useState<SupportedEmailLocale>('de')
  const [configByLocale, setConfigByLocale] = useState<Record<string, SingleLocaleEmailConfig>>(
    () => {
      const initial: Record<string, SingleLocaleEmailConfig> = {}
      const hasLocaleKeys = SUPPORTED_EMAIL_LOCALES.some(
        (locale) => initialConfigByLocale[locale] != null
      )
      if (hasLocaleKeys) {
        for (const locale of SUPPORTED_EMAIL_LOCALES) {
          initial[locale] = { ...initialConfigByLocale[locale] }
        }
      } else {
        const flat = initialConfigByLocale as unknown as SingleLocaleEmailConfig
        if (flat && typeof flat.greeting === 'string') {
          initial.de = { ...flat }
        }
        for (const locale of SUPPORTED_EMAIL_LOCALES) {
          if (!initial[locale]) initial[locale] = {}
        }
      }
      return initial
    }
  )
  const [enabled, setEnabled] = useState(initialEnabled)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [isPending, setIsPending] = useState(false)
  const { toast } = useToast()

  const config = configByLocale[activeLocale] ?? {}
  const defaults = defaultCopyByLocale[activeLocale] ?? {}

  const updateConfig = (locale: string, updates: Partial<SingleLocaleEmailConfig>) => {
    setConfigByLocale((prev) => ({
      ...prev,
      [locale]: { ...(prev[locale] ?? {}), ...updates },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)
    const result = await updateEmailTemplateAction({
      key: templateKey,
      configByLocale,
      enabled,
    })
    setIsPending(false)
    if (result?.data?.success) {
      toast({ title: t('saved') })
    }
    if (result?.serverError) {
      toast({ title: t('save'), description: result.serverError, variant: 'destructive' })
    }
  }

  const handlePreview = async () => {
    const result = await getEmailPreviewHtmlAction({
      key: templateKey,
      locale: activeLocale,
      config: configByLocale[activeLocale],
    })
    if (result?.data?.html) {
      setPreviewHtml(result.data.html)
      setPreviewOpen(true)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          {SUPPORTED_EMAIL_LOCALES.map((locale) => (
            <Button
              key={locale}
              type="button"
              variant={activeLocale === locale ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveLocale(locale)}
            >
              {getLocaleLabel(locale, t)}
            </Button>
          ))}
        </div>

        <p className="text-muted-foreground text-sm">
          {t('description')} – {getLocaleLabel(activeLocale, t)}
        </p>

        <div className="space-y-2">
          <Label htmlFor={`${templateKey}-${activeLocale}-subject`}>{t('subject')}</Label>
          <Input
            id={`${templateKey}-${activeLocale}-subject`}
            value={config.subject ?? ''}
            onChange={(e) => updateConfig(activeLocale, { subject: e.target.value })}
            placeholder={defaults.subject}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${templateKey}-${activeLocale}-greeting`}>{t('greeting')}</Label>
          <Input
            id={`${templateKey}-${activeLocale}-greeting`}
            value={config.greeting ?? ''}
            onChange={(e) => updateConfig(activeLocale, { greeting: e.target.value })}
            placeholder={defaults.greeting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${templateKey}-${activeLocale}-mainText`}>{t('mainText')}</Label>
          <Textarea
            id={`${templateKey}-${activeLocale}-mainText`}
            value={config.mainText ?? ''}
            onChange={(e) => updateConfig(activeLocale, { mainText: e.target.value })}
            rows={4}
            placeholder={defaults.mainText}
            className="resize-y"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${templateKey}-${activeLocale}-ctaText`}>{t('ctaText')}</Label>
          <Input
            id={`${templateKey}-${activeLocale}-ctaText`}
            value={config.ctaText ?? ''}
            onChange={(e) => updateConfig(activeLocale, { ctaText: e.target.value })}
            placeholder={defaults.ctaText}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${templateKey}-${activeLocale}-footer`}>{t('footer')}</Label>
          <Textarea
            id={`${templateKey}-${activeLocale}-footer`}
            value={config.footer ?? ''}
            onChange={(e) => updateConfig(activeLocale, { footer: e.target.value })}
            rows={2}
            placeholder={defaults.footer}
            className="resize-y"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${templateKey}-${activeLocale}-footerHelp`}>{t('footerHelp')}</Label>
          <Textarea
            id={`${templateKey}-${activeLocale}-footerHelp`}
            value={config.footerHelp ?? ''}
            onChange={(e) => updateConfig(activeLocale, { footerHelp: e.target.value })}
            rows={2}
            placeholder={defaults.footerHelp}
            className="resize-y"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${templateKey}-${activeLocale}-disclaimer`}>
            {t('disclaimer', { appUrl: '{appUrl}' })}
          </Label>
          <Input
            id={`${templateKey}-${activeLocale}-disclaimer`}
            value={config.disclaimer ?? ''}
            onChange={(e) => updateConfig(activeLocale, { disclaimer: e.target.value })}
            placeholder={defaults.disclaimer}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-input"
            />
            {t('enabled')}
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? '…' : t('save')}
          </Button>
          <Button type="button" variant="outline" onClick={handlePreview}>
            {t('preview')}
          </Button>
        </div>
      </form>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('preview')} – {templateKeyLabel} ({getLocaleLabel(activeLocale, t)})
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-[400px] overflow-auto rounded border bg-muted/30">
            <iframe
              title={t('preview')}
              srcDoc={previewHtml}
              className="h-[70vh] w-full border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
