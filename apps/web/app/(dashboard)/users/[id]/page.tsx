import { FormPageLayout } from '@/components/layout/form-page-layout'
import { UserForm } from '@/components/users/user-form'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { getUser } from '@/lib/actions/user-actions'
import { canManageUser } from '@habidat/auth/roles'
import { requireGroupAdmin } from '@habidat/auth/session'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditUserPage({ params }: PageProps) {
  const { id } = await params
  const session = await requireGroupAdmin()
  const [user, groups] = await Promise.all([getUser(id), getGroupsForSelect()])

  if (!user) {
    notFound()
  }

  if (!canManageUser(session, user.memberships)) {
    notFound()
  }

  return (
    <FormPageLayout backHref="/users" title={user.name} description={`@${user.username}`}>
      <UserForm user={user} groups={groups} />
    </FormPageLayout>
  )
}
