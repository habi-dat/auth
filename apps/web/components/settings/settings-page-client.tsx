'use client'

import { useTranslations } from 'next-intl'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { EmailTemplateForm } from '@/components/settings/email-template-form'
import { GeneralSettingsForm } from '@/components/settings/general-settings-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { EmailTemplateConfigByLocale } from '@/lib/email/types'
import type { GeneralSettings } from '@/lib/settings/general'

const SETTINGS_TABS = ['general', 'templates'] as const

type SettingsTab = (typeof SETTINGS_TABS)[number]

interface SettingsPageClientProps {
  generalSettings: GeneralSettings
  inviteConfigByLocale: EmailTemplateConfigByLocale
  passwordResetConfigByLocale: EmailTemplateConfigByLocale
  defaultCopyInvite: Record<string, Record<string, string>>
  defaultCopyPasswordReset: Record<string, Record<string, string>>
  inviteEnabled: boolean
  passwordResetEnabled: boolean
}

export function SettingsPageClient({
  generalSettings,
  inviteConfigByLocale,
  passwordResetConfigByLocale,
  defaultCopyInvite,
  defaultCopyPasswordReset,
  inviteEnabled,
  passwordResetEnabled,
}: SettingsPageClientProps) {
  const t = useTranslations('settings')
  const tTemplates = useTranslations('settings.templates')

  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(SETTINGS_TABS).withDefault('general').withOptions({ shallow: true })
  )

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)} className="space-y-6">
      <TabsList>
        <TabsTrigger value="general">{t('tabGeneral')}</TabsTrigger>
        <TabsTrigger value="templates">{t('tabTemplates')}</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('general.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <GeneralSettingsForm initialSettings={generalSettings} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="templates" className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{tTemplates('invite')}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailTemplateForm
              templateKey="invite"
              templateKeyLabel={tTemplates('invite')}
              initialConfigByLocale={inviteConfigByLocale}
              defaultCopyByLocale={defaultCopyInvite}
              initialEnabled={inviteEnabled}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tTemplates('passwordReset')}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailTemplateForm
              templateKey="passwordReset"
              templateKeyLabel={tTemplates('passwordReset')}
              initialConfigByLocale={passwordResetConfigByLocale}
              defaultCopyByLocale={defaultCopyPasswordReset}
              initialEnabled={passwordResetEnabled}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
