import { GroupForm } from '@/components/groups/group-form'
import { Button } from '@/components/ui/button'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { requireAdmin } from '@/lib/auth/session'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function NewGroupPage() {
  const t = await getTranslations('groups')
  await requireAdmin()
  const allGroups = await getGroupsForSelect()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/groups">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{t('newGroup')}</h1>
      </div>

      <GroupForm allGroups={allGroups} isAdmin={true} />
    </div>
  )
}
