import { canManageGroup } from '@habidat/auth/roles'
import { requireUserWithGroups } from '@habidat/auth/session'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { GroupForm } from '@/components/groups/group-form'
import { GroupMembers } from '@/components/groups/group-members'
import { FormPageLayout } from '@/components/layout/form-page-layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getGroup, getGroupsForSelect } from '@/lib/actions/group-actions'
import { getUsersForSelect } from '@/lib/actions/user-actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditGroupPage({ params }: PageProps) {
  const t = await getTranslations('groups')
  const { id } = await params
  const session = await requireUserWithGroups()
  const [group, allGroups, allUsers] = await Promise.all([
    getGroup(id),
    getGroupsForSelect(),
    getUsersForSelect(),
  ])

  if (!group) {
    notFound()
  }

  const canManage = canManageGroup(session, group.id)

  return (
    <FormPageLayout
      backHref="/groups"
      title={group.name}
      description={`@${group.slug}`}
      className="max-w-4xl"
    >
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">{t('membersTab')}</TabsTrigger>
          {canManage && <TabsTrigger value="settings">{t('settingsTab')}</TabsTrigger>}
        </TabsList>
        <TabsContent value="members" className="mt-6">
          <GroupMembers group={group} users={allUsers} canManage={canManage} />
        </TabsContent>
        {canManage && (
          <TabsContent value="settings" className="mt-6">
            <GroupForm group={group} allGroups={allGroups} isAdmin={session.isAdmin} />
          </TabsContent>
        )}
      </Tabs>
    </FormPageLayout>
  )
}
