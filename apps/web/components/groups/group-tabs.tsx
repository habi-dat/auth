'use client'

import { useTranslations } from 'next-intl'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { GroupForm } from '@/components/groups/group-form'
import { GroupMembers } from '@/components/groups/group-members'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { getGroup, getGroupsForSelect } from '@/lib/actions/group-actions'
import type { getUsersForSelect } from '@/lib/actions/user-actions'

const GROUP_TABS = ['members', 'settings'] as const
type GroupTab = (typeof GROUP_TABS)[number]

interface GroupTabsProps {
  group: NonNullable<Awaited<ReturnType<typeof getGroup>>>
  allGroups: Awaited<ReturnType<typeof getGroupsForSelect>>
  allUsers: Awaited<ReturnType<typeof getUsersForSelect>>
  canManage: boolean
  isAdmin: boolean
}

export function GroupTabs({ group, allGroups, allUsers, canManage, isAdmin }: GroupTabsProps) {
  const t = useTranslations('groups')
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(GROUP_TABS).withDefault('members').withOptions({ shallow: true })
  )

  const activeTab = !canManage && tab === 'settings' ? 'members' : tab

  return (
    <Tabs value={activeTab} onValueChange={(v) => setTab(v as GroupTab)}>
      <TabsList>
        <TabsTrigger value="members">{t('membersTab')}</TabsTrigger>
        {canManage && <TabsTrigger value="settings">{t('settingsTab')}</TabsTrigger>}
      </TabsList>
      <TabsContent value="members" className="mt-6">
        <GroupMembers group={group} users={allUsers} canManage={canManage} />
      </TabsContent>
      {canManage && (
        <TabsContent value="settings" className="mt-6">
          <GroupForm group={group} allGroups={allGroups} isAdmin={isAdmin} />
        </TabsContent>
      )}
    </Tabs>
  )
}
