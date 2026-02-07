import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUserWithGroups } from '@habidat/auth/session'
import { Globe, HardDrive, Key, Mail, MapPin, Pencil, ShieldCheck, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function ProfilePage() {
  const t = await getTranslations('profile')
  const { user, memberships, ownerships, primaryGroup } = await requireUserWithGroups()

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const langLabel =
    user.preferredLanguage === 'de' ? t('languageDe') : user.preferredLanguage || t('languageDe')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <div className="flex gap-2">
          <Link href="/profile/edit">
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              {t('edit')}
            </Button>
          </Link>
          <Link href="/profile/password">
            <Button variant="outline">
              <Key className="mr-2 h-4 w-4" />
              {t('changePassword')}
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{user.name}</CardTitle>
              <CardDescription className="text-base">@{user.username}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{t('email')}</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{t('location')}</p>
                <p className="font-medium">{user.location ?? '—'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{t('primaryGroup')}</p>
                <p className="font-medium">{primaryGroup?.name ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">{t('groups')}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {memberships.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    memberships.map((m) => (
                      <Badge key={m.group.id} variant="secondary">
                        {m.group.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
            {ownerships.length > 0 && (
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('groupAdmins')}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ownerships.map((o) => (
                      <Badge key={o.group.id} variant="default">
                        {o.group.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{t('preferredLanguage')}</p>
                <p className="font-medium">{langLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{t('storageQuota')}</p>
                <p className="font-medium">{user.storageQuota}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
