import { requireGroupAdmin } from '@habidat/auth/session'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { InvitesTable } from '@/components/invites/invites-table'
import { ListPageLayout } from '@/components/layout/list-page-layout'
import { Button } from '@/components/ui/button'
import { getGroupsForSelect, getInvites } from '@/lib/actions/invite-actions'

export default async function InvitesPage() {
  await requireGroupAdmin()
  const t = await getTranslations('invites')
  const [invites, groups] = await Promise.all([getInvites(), getGroupsForSelect()])

  return (
    <ListPageLayout
      title={t('title')}
      description={t('description')}
      actions={
        <Link href="/invites/new">
          <Button>
            <Plus className="h-4 w-4" />
            {t('createInvite')}
          </Button>
        </Link>
      }
    >
      <InvitesTable invites={invites} groups={groups} />
    </ListPageLayout>
  )
}
