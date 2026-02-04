import { GroupForm } from '@/components/groups/group-form'
import { GroupMembers } from '@/components/groups/group-members'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getGroup, getGroupsForSelect } from '@/lib/actions/group-actions'
import { canManageGroup } from '@/lib/auth/roles'
import { requireUserWithGroups } from '@/lib/auth/session'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditGroupPage({ params }: PageProps) {
  const t = await getTranslations('groups')
  const { id } = await params
  const session = await requireUserWithGroups()
  const [group, allGroups] = await Promise.all([getGroup(id), getGroupsForSelect()])

  if (!group) {
    notFound()
  }

  const canManage = canManageGroup(session, group.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/groups">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground">@{group.slug}</p>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">{t('membersTab')}</TabsTrigger>
          {canManage && <TabsTrigger value="settings">{t('settingsTab')}</TabsTrigger>}
        </TabsList>
        <TabsContent value="members" className="mt-6">
          <GroupMembers group={group} canManage={canManage} />
        </TabsContent>
        {canManage && (
          <TabsContent value="settings" className="mt-6">
            <GroupForm group={group} allGroups={allGroups} isAdmin={session.isAdmin} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
