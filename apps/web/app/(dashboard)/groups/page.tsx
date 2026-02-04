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
import { getGroups } from '@/lib/actions/group-actions'
import { requireUserWithGroups } from '@/lib/auth/session'
import { FolderTree, Loader2, Plus, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Suspense } from 'react'

async function GroupsTable({ isAdmin }: { isAdmin: boolean }) {
  const t = await getTranslations('groups')
  const groups = await getGroups()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('name')}</TableHead>
          <TableHead>{t('description')}</TableHead>
          <TableHead>{t('members')}</TableHead>
          <TableHead>{t('hierarchy')}</TableHead>
          <TableHead className="text-right">{t('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              {t('noGroups')}
            </TableCell>
          </TableRow>
        ) : (
          groups.map((group) => (
            <TableRow key={group.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{group.name}</span>
                  {group.isSystem && (
                    <Badge variant="outline" className="text-xs">
                      {t('system')}
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">@{group.slug}</span>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">{group.description}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{group._count.memberships}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1 text-sm">
                  {group.parentGroups.length > 0 && (
                    <div className="flex items-center gap-1">
                      <FolderTree className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {group.parentGroups.map((p) => p.parentGroup.name).join(', ')}
                      </span>
                    </div>
                  )}
                  {group.childGroups.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {t('subgroupsCount', { count: group.childGroups.length })}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/groups/${group.id}`}>
                  <Button variant="ghost" size="sm">
                    {isAdmin || group.ownerships.length > 0 ? t('edit') : t('view')}
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
            <GroupsTable isAdmin={session.isAdmin} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
