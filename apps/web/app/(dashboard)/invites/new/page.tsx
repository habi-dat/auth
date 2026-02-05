import { FormPageLayout } from '@/components/layout/form-page-layout'
import { InviteForm } from '@/components/invites/invite-form'
import { getGroupsForSelect } from '@/lib/actions/invite-actions'
import { requireGroupAdmin } from '@/lib/auth/session'
import { getTranslations } from 'next-intl/server'

export default async function NewInvitePage() {
  await requireGroupAdmin()
  const t = await getTranslations('invites')
  const groups = await getGroupsForSelect()

  return (
    <FormPageLayout backHref="/invites" title={t('newInvite')}>
      <InviteForm groups={groups} />
    </FormPageLayout>
  )
}
