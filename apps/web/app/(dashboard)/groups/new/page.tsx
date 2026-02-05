import { GroupForm } from '@/components/groups/group-form'
import { FormPageLayout } from '@/components/layout/form-page-layout'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { requireAdmin } from '@/lib/auth/session'
import { getTranslations } from 'next-intl/server'

export default async function NewGroupPage() {
  const t = await getTranslations('groups')
  await requireAdmin()
  const allGroups = await getGroupsForSelect()

  return (
    <FormPageLayout backHref="/groups" title={t('newGroup')}>
      <GroupForm allGroups={allGroups} isAdmin={true} />
    </FormPageLayout>
  )
}
