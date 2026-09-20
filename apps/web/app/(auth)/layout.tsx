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
      <aside className="w-full md:w-1/3 md:min-h-screen border-b md:border-b-0 md:border-r bg-muted/40 px-8 py-10 md:px-12 flex flex-col justify-center gap-6">
        <div className="flex items-center gap-4">
          {logoSrc ? (
            <div className="h-20 w-20 flex-shrink-0">
              <Image
                src={logoSrc}
                alt={displayName || ''}
                className="h-full w-full object-contain"
                width={80}
                height={80}
              />
            </div>
          ) : displayName ? (
            <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          ) : null}
          {displayName ? (
            <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
          ) : null}
        </div>
        {loginPageText ? (
          <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap max-w-sm">
            {loginPageText}
          </p>
        ) : null}
      </aside>
      <main className="flex-1 px-6 py-10 md:px-12 md:py-16 lg:px-16 flex items-start justify-start">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
