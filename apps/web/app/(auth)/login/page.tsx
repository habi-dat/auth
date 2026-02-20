import Image from 'next/image'
import { LoginForm } from '@/components/auth/login-form'
import { getGeneralSettings } from '@/lib/settings/general'
import { cn } from '@/lib/utils'

export default async function LoginPage() {
  const settings = await getGeneralSettings().catch(() => ({
    platformName: undefined,
    logoUrl: undefined,
    logoUpdatedAt: undefined,
    loginPageText: undefined,
  }))

  const logoSrc =
    settings.logoUrl && settings.logoUpdatedAt
      ? `${settings.logoUrl}?v=${settings.logoUpdatedAt}`
      : settings.logoUrl

  return (
    <div
      className={cn('relative w-full max-w-md mx-auto overflow-visible', logoSrc && 'pt-16 pl-12')}
    >
      {logoSrc ? (
        <div className="absolute top-6 -left-3 z-10 h-32 w-32 drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)] dark:drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <Image
            src={logoSrc}
            alt=""
            className="h-full w-full object-contain"
            width={128}
            height={128}
          />
        </div>
      ) : null}
      <div className="relative w-full rounded-xl border border-border/60 bg-card p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        <LoginForm platformName={settings.platformName} loginPageText={settings.loginPageText} />
      </div>
    </div>
  )
}
