import { GroupsTable } from '@/components/groups/groups-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        {session.isAdmin && (
          <Link href="/groups/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('createGroup')}
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('allGroups')}</CardTitle>
          <CardDescription>{t('allGroupsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <GroupsTableWrapper isAdmin={session.isAdmin} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
