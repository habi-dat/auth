import { GroupsTable } from '@/components/groups/groups-table'
import { ListPageLayout } from '@/components/layout/list-page-layout'
import { Button } from '@/components/ui/button'
import { getGroups } from '@/lib/actions/group-actions'
import { requireUserWithGroups } from '@/lib/auth/session'
import { Loader2, Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Suspense } from 'react'

async function GroupsTableWrapper({ isAdmin }: { isAdmin: boolean }) {
  const groups = await getGroups()
  return <GroupsTable groups={groups} isAdmin={isAdmin} />
}

export default async function GroupsPage() {
  const t = await getTranslations('groups')
  const session = await requireUserWithGroups()

  return (
    <ListPageLayout
      title={t('title')}
      description={t('description')}
      actions={
        session.isAdmin ? (
          <Link href="/groups/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('createGroup')}
            </Button>
          </Link>
        ) : undefined
      }
    >
      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <GroupsTableWrapper isAdmin={session.isAdmin} />
      </Suspense>
    </ListPageLayout>
  )
}
