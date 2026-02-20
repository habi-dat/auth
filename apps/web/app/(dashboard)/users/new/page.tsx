import { requireGroupAdmin } from '@habidat/auth/session'
import { getTranslations } from 'next-intl/server'
import { FormPageLayout } from '@/components/layout/form-page-layout'
import { UserForm } from '@/components/users/user-form'
import { getGroupsForSelect } from '@/lib/actions/group-actions'

export default async function NewUserPage() {
  const t = await getTranslations('users')
  const session = await requireGroupAdmin()
  const groups = await getGroupsForSelect()

  return (
    <FormPageLayout backHref="/users" title={t('form.titleCreate')}>
      <UserForm groups={groups} isAdmin={session.isAdmin} />
    </FormPageLayout>
  )
}
