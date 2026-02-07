import { ListPageLayout } from '@/components/layout/list-page-layout'
import { InviteForm } from '@/components/invites/invite-form'
import { InvitesTable } from '@/components/invites/invites-table'
import { getInvites, getGroupsForSelect } from '@/lib/actions/invite-actions'
import { requireGroupAdmin } from '@habidat/auth/session'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function InvitesPage() {
  await requireGroupAdmin()
  const t = await getTranslations('invites')
  const [invites, groups] = await Promise.all([
    getInvites(),
    getGroupsForSelect(),
  ])

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
