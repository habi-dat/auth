import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UsersTable } from '@/components/users/users-table'
import { getUsers } from '@/lib/actions/user-actions'
import { requireAdmin } from '@/lib/auth/session'
import { Loader2, Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Suspense } from 'react'

async function UsersTableWrapper() {
  const users = await getUsers()
  return <UsersTable users={users} />
}

export default async function UsersPage() {
  const t = await getTranslations('users')
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Link href="/users/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t('createUser')}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('allUsers')}</CardTitle>
          <CardDescription>{t('allUsersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <UsersTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
