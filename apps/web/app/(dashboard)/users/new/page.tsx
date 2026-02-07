import { FormPageLayout } from '@/components/layout/form-page-layout'
import { UserForm } from '@/components/users/user-form'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { requireGroupAdmin } from '@habidat/auth/session'
import { getTranslations } from 'next-intl/server'

export default async function NewUserPage() {
  const t = await getTranslations('users')
  await requireGroupAdmin()
  const groups = await getGroupsForSelect()

  return (
    <FormPageLayout backHref="/users" title={t('newUser')}>
      <UserForm groups={groups} />
    </FormPageLayout>
  )
}
