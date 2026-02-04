import { Button } from '@/components/ui/button'
import { UserForm } from '@/components/users/user-form'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { requireGroupAdmin } from '@/lib/auth/session'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function NewUserPage() {
  const t = await getTranslations('users')
  await requireGroupAdmin()
  const groups = await getGroupsForSelect()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{t('newUser')}</h1>
      </div>

      <UserForm groups={groups} />
    </div>
  )
}
