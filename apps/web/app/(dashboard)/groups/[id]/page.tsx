import { canManageGroup } from '@habidat/auth/roles'
import { requireUserWithGroups } from '@habidat/auth/session'
import { notFound } from 'next/navigation'
import { GroupTabs } from '@/components/groups/group-tabs'
import { FormPageLayout } from '@/components/layout/form-page-layout'
import { getGroup, getGroupsForSelect } from '@/lib/actions/group-actions'
import { getUsersForSelect } from '@/lib/actions/user-actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditGroupPage({ params }: PageProps) {
  const { id } = await params
  const session = await requireUserWithGroups()
  const group = await getGroup(id)

  if (!group) {
    notFound()
  }

  if (!canManageGroup(session, group.id)) {
    notFound()
  }

  const [allGroups, allUsers] = await Promise.all([getGroupsForSelect(), getUsersForSelect()])

  return (
    <FormPageLayout
      backHref="/groups"
      title={group.name}
      description={`@${group.slug}`}
      className="max-w-4xl"
    >
      <GroupTabs
        group={group}
        allGroups={allGroups}
        allUsers={allUsers}
        canManage={true}
        isAdmin={session.isAdmin}
      />
    </FormPageLayout>
  )
}
