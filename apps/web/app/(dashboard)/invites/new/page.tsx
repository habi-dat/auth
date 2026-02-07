import { requireGroupAdmin } from '@habidat/auth/session'
import { getTranslations } from 'next-intl/server'
import { InviteForm } from '@/components/invites/invite-form'
import { FormPageLayout } from '@/components/layout/form-page-layout'
import { getGroupsForSelect } from '@/lib/actions/invite-actions'

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
