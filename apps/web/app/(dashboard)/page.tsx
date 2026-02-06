import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { getUserApps } from '@/lib/actions/app-actions'
import { requireUserWithGroups } from '@/lib/auth/session'
import { ExternalLink } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function HomePage() {
  const t = await getTranslations('home')
  const { memberships } = await requireUserWithGroups()

  const userGroupIds = memberships.map((m) => m.groupId)
  const apps = await getUserApps(userGroupIds)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {apps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('noApps')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {apps.map((app) => {
            const displayImage = app.useIconAsLogo ? app.iconUrl : app.logoUrl || app.iconUrl

            return (
              <Link
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      {displayImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={displayImage}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-contain bg-muted border"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-lg">
                          {app.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold tracking-tight truncate flex items-center gap-2">
                          {app.name}
                          <ExternalLink className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                        </h3>
                      </div>
                    </div>
                  </CardHeader>
                  {app.description && (
                    <CardContent className="pt-0">
                      <CardDescription className="line-clamp-2">{app.description}</CardDescription>
                    </CardContent>
                  )}
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
