import { requireUserWithGroups } from '@habidat/auth/session'
import { getTranslations } from 'next-intl/server'
import { PageLayout } from '@/components/layout/page-layout'
import { MailSwitchPage } from '@/components/mail/mail-switch-page'
import { getMailSwitchData } from '@/lib/actions/discourse-mail-actions'

export default async function MailPage() {
  await requireUserWithGroups()
  const t = await getTranslations('mailSettings')
  const data = await getMailSwitchData()

  return (
    <PageLayout title={t('title')}>
      {data ? (
        <MailSwitchPage initialData={data} />
      ) : (
        <p className="text-muted-foreground">{t('notConfigured')}</p>
      )}
    </PageLayout>
  )
}
