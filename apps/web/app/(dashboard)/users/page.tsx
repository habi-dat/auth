import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getUsers } from '@/lib/actions/user-actions'
import { requireAdmin } from '@/lib/auth/session'
import { Loader2, Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Suspense } from 'react'

async function UsersTable() {
  const t = await getTranslations('users')
  const users = await getUsers()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('name')}</TableHead>
          <TableHead>{t('email')}</TableHead>
          <TableHead>{t('username')}</TableHead>
          <TableHead>{t('groups')}</TableHead>
          <TableHead className="text-right">{t('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              {t('noUsers')}
            </TableCell>
          </TableRow>
        ) : (
          users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="text-muted-foreground">@{user.username}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.memberships.slice(0, 3).map((m) => (
                    <Badge key={m.group.id} variant="secondary">
                      {m.group.name}
                    </Badge>
                  ))}
                  {user.memberships.length > 3 && (
                    <Badge variant="outline">+{user.memberships.length - 3}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/users/${user.id}`}>
                  <Button variant="ghost" size="sm">
                    {t('edit')}
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
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
            <UsersTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
