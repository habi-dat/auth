import { ListPageLayout } from '@/components/layout/list-page-layout'
import { SettingsPageClient } from '@/components/settings/settings-page-client'
import { getDefaultEmailCopy, getSupportedEmailLocales } from '@/lib/email/defaults'
import { getEmailTemplates } from '@/lib/email/templates'
import type { EmailTemplateConfigByLocale, SupportedEmailLocale } from '@/lib/email/types'
import { getGeneralSettings } from '@/lib/settings/general'
import { requireAdmin } from '@habidat/auth/session'
import { getTranslations } from 'next-intl/server'

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  await requireAdmin()
  const t = await getTranslations('settings')
  const params = await searchParams
  const defaultTab = params.tab === 'templates' ? ('templates' as const) : ('general' as const)

  const [generalSettings, templates] = await Promise.all([
    getGeneralSettings(),
    getEmailTemplates(),
  ])

  const inviteTemplate = templates.find((x) => x.key === 'invite')
  const passwordResetTemplate = templates.find((x) => x.key === 'passwordReset')

  const locales = getSupportedEmailLocales()
  const defaultCopyInvite = Object.fromEntries(
    locales.map((locale) => [
      locale,
      getDefaultEmailCopy(locale as SupportedEmailLocale, 'invite') as Record<string, string>,
    ])
  ) as Record<string, Record<string, string>>
  const defaultCopyPasswordReset = Object.fromEntries(
    locales.map((locale) => [
      locale,
      getDefaultEmailCopy(locale as SupportedEmailLocale, 'passwordReset') as Record<
        string,
        string
      >,
    ])
  ) as Record<string, Record<string, string>>

  const inviteConfigByLocale = (inviteTemplate?.config as EmailTemplateConfigByLocale | null) ?? {}
  const passwordResetConfigByLocale =
    (passwordResetTemplate?.config as EmailTemplateConfigByLocale | null) ?? {}

  return (
    <ListPageLayout title={t('title')} description={t('description')}>
      <SettingsPageClient
        generalSettings={generalSettings}
        inviteConfigByLocale={inviteConfigByLocale}
        passwordResetConfigByLocale={passwordResetConfigByLocale}
        defaultCopyInvite={defaultCopyInvite}
        defaultCopyPasswordReset={defaultCopyPasswordReset}
        inviteEnabled={inviteTemplate?.enabled ?? true}
        passwordResetEnabled={passwordResetTemplate?.enabled ?? true}
        defaultTab={defaultTab}
      />
    </ListPageLayout>
  )
}
