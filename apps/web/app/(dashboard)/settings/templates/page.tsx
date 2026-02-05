import { ListPageLayout } from '@/components/layout/list-page-layout'
import { EmailTemplateForm } from '@/components/settings/email-template-form'
import {
  getDefaultEmailCopy,
  getSupportedEmailLocales,
} from '@/lib/email/defaults'
import { getEmailTemplates } from '@/lib/email/templates'
import type { EmailTemplateConfigByLocale, SupportedEmailLocale } from '@/lib/email/types'
import { requireAdmin } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTranslations } from 'next-intl/server'

export default async function EmailTemplatesPage() {
  await requireAdmin()
  const t = await getTranslations('settings.templates')

  const templates = await getEmailTemplates()
  const inviteTemplate = templates.find((x) => x.key === 'invite')
  const passwordResetTemplate = templates.find((x) => x.key === 'passwordReset')

  const locales = getSupportedEmailLocales()
  const defaultCopyByLocale = {
    invite: Object.fromEntries(
      locales.map((locale) => [
        locale,
        getDefaultEmailCopy(locale as SupportedEmailLocale, 'invite'),
      ])
    ) as Record<string, Record<string, string>>,
    passwordReset: Object.fromEntries(
      locales.map((locale) => [
        locale,
        getDefaultEmailCopy(locale as SupportedEmailLocale, 'passwordReset'),
      ])
    ) as Record<string, Record<string, string>>,
  }

  const inviteConfigByLocale = (inviteTemplate?.config as EmailTemplateConfigByLocale | null) ?? {}
  const passwordResetConfigByLocale =
    (passwordResetTemplate?.config as EmailTemplateConfigByLocale | null) ?? {}

  return (
    <ListPageLayout title={t('title')} description={t('description')}>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('invite')}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailTemplateForm
              templateKey="invite"
              templateKeyLabel={t('invite')}
              initialConfigByLocale={inviteConfigByLocale}
              defaultCopyByLocale={defaultCopyByLocale.invite}
              initialEnabled={inviteTemplate?.enabled ?? true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('passwordReset')}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailTemplateForm
              templateKey="passwordReset"
              templateKeyLabel={t('passwordReset')}
              initialConfigByLocale={passwordResetConfigByLocale}
              defaultCopyByLocale={defaultCopyByLocale.passwordReset}
              initialEnabled={passwordResetTemplate?.enabled ?? true}
            />
          </CardContent>
        </Card>
      </div>
    </ListPageLayout>
  )
}
