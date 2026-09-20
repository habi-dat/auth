import Image from 'next/image'
import { getGeneralSettings } from '@/lib/settings/general'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getGeneralSettings().catch(() => ({
    platformName: undefined,
    loginPageText: undefined,
    logoUrl: undefined,
    logoUpdatedAt: undefined,
  }))

  const logoSrc =
    settings.logoUrl && settings.logoUpdatedAt
      ? `${settings.logoUrl}?v=${settings.logoUpdatedAt}`
      : settings.logoUrl
  const displayName = settings.platformName?.trim()
  const loginPageText = settings.loginPageText?.trim()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <aside className="w-full md:w-1/3 md:min-h-screen border-b md:border-b-0 md:border-r bg-muted/40 px-6 pt-12 pb-6 md:px-12 md:py-10 flex flex-row items-center justify-start text-left gap-4 md:flex-col md:items-center md:justify-center md:text-center md:gap-8">
        {logoSrc ? (
          <div className="h-24 w-24 md:h-56 md:w-56 flex-shrink-0">
            <Image
              src={logoSrc}
              alt={displayName || ''}
              className="h-full w-full object-contain"
              width={224}
              height={224}
            />
          </div>
        ) : displayName ? (
          <div className="h-16 w-16 md:h-32 md:w-32 flex-shrink-0 rounded-2xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-2xl md:text-5xl">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        ) : null}
        {displayName || loginPageText ? (
          <div className="min-w-0 max-w-md space-y-0">
            {displayName ? (
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">{displayName}</h1>
            ) : null}
            {loginPageText ? (
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed whitespace-pre-wrap">
                {loginPageText}
              </p>
            ) : null}
          </div>
        ) : null}
      </aside>
      <main className="flex-1 px-6 py-8 md:px-12 md:py-16 lg:px-16 flex items-start md:items-center justify-start">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
