import { requireUserWithGroups } from '@habidat/auth/session'
import { ExternalLink, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { getUserApps } from '@/lib/actions/app-actions'
import { getGeneralSettings } from '@/lib/settings/general'
import { cn } from '@/lib/utils'

export default async function HomePage() {
  const t = await getTranslations('home')
  const { user, memberships } = await requireUserWithGroups()
  const settings = await getGeneralSettings()

  const userGroupIds = memberships.map((m) => m.groupId)
  const apps = await getUserApps(userGroupIds)

  const mainApps = apps.filter((app) => app.isMain)
  const otherApps = apps.filter((app) => !app.isMain)

  const firstName = user.name.split(' ')[0]
  const title = settings.dashboardTitle
    ? settings.dashboardTitle.replace('{name}', firstName)
    : t('welcome', { name: firstName })
  const description = settings.dashboardDescription || t('description')

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <div className="relative overflow-hidden py-6 ">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">{description}</p>
        </div>
      </div>

      {apps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 text-center text-muted-foreground">
            {t('noApps')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-16">
          {mainApps.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <h2 className="text-2xl font-bold tracking-tight">{t('mainApps')}</h2>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {mainApps.map((app) => (
                  <AppCard key={app.id} app={app} variant="main" />
                ))}
              </div>
            </section>
          )}

          {otherApps.length > 0 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold tracking-tight text-muted-foreground/70">
                {t('otherApps')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {otherApps.map((app) => (
                  <AppCard key={app.id} app={app} variant="compact" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

type App = Awaited<ReturnType<typeof getUserApps>>[number]

function AppCard({ app, variant }: { app: App; variant: 'main' | 'compact' }) {
  const displayImage = app.useIconAsLogo ? app.iconUrl : app.logoUrl || app.iconUrl

  return (
    <Link href={app.url} target="_blank" rel="noopener noreferrer" className="group">
      <Card
        className={cn(
          'h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2',
          variant === 'main'
            ? 'border-primary/20 hover:border-primary/50'
            : 'hover:border-primary/30'
        )}
      >
        <CardHeader
          className={cn(variant === 'main' ? 'pb-6' : 'pb-4', variant === 'main' ? 'pt-6' : 'pt-4')}
        >
          <div
            className={cn(
              'flex items-center gap-4',
              variant === 'main' ? 'flex-col sm:flex-row sm:items-center' : 'items-center'
            )}
          >
            {displayImage ? (
              <div
                className={cn(
                  'relative shrink-0 overflow-hidden rounded-2xl bg-muted border shadow-sm transition-transform group-hover:scale-105',
                  variant === 'main' ? 'h-16 w-16' : 'h-12 w-12'
                )}
              >
                <Image src={displayImage} alt="" fill className="object-contain p-2" />
              </div>
            ) : (
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold transition-transform group-hover:scale-105',
                  variant === 'main' ? 'h-16 w-16 text-2xl' : 'h-12 w-12 text-lg'
                )}
              >
                {app.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div
              className={cn('min-w-0 flex-1', variant === 'main' ? 'text-center sm:text-left' : '')}
            >
              <h3
                className={cn(
                  'font-bold tracking-tight flex items-center gap-2',
                  variant === 'main' ? 'text-xl justify-center sm:justify-start' : 'text-base'
                )}
              >
                <span className="truncate">{app.name}</span>
                <ExternalLink className="h-4 w-4 opacity-0 transition-all group-hover:opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </h3>
            </div>
          </div>
        </CardHeader>
        {app.description && (
          <CardContent className="pt-0">
            <CardDescription
              className={cn(
                'line-clamp-2',
                variant === 'main' ? 'text-base text-muted-foreground' : 'text-sm'
              )}
            >
              {app.description}
            </CardDescription>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}
