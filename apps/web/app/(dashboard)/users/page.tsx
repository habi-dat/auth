import { requireAdmin } from '@habidat/auth/session'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { ListPageLayout } from '@/components/layout/list-page-layout'
import { Button } from '@/components/ui/button'
import { UsersTable } from '@/components/users/users-table'
import { getUsers } from '@/lib/actions/user-actions'

async function UsersTableWrapper() {
  const users = await getUsers()
  return <UsersTable users={users} />
}

export default async function UsersPage() {
  const t = await getTranslations('users')
  await requireAdmin()

  return (
    <ListPageLayout
      title={t('title')}
      description={t('description')}
      actions={
        <Link href="/users/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t('createUser')}
          </Button>
        </Link>
      }
    >
      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <UsersTableWrapper />
      </Suspense>
    </ListPageLayout>
  )
}
