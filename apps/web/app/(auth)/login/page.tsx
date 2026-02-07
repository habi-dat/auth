import Image from 'next/image'
import { LoginForm } from '@/components/auth/login-form'
import { getGeneralSettings } from '@/lib/settings/general'

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
    <div className="flex w-full max-w-sm mx-auto flex-col items-center">
      {logoSrc ? (
        <div className="flex h-32 shrink-0 items-center justify-center overflow-hidden">
          <Image
            src={logoSrc}
            alt=""
            className="h-full w-full object-contain"
            width={256}
            height={256}
          />
        </div>
      ) : null}
      <div className="relative w-full rounded-2xl border border-border/80 bg-card/95 p-8 shadow-xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5 backdrop-blur-sm overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/8 via-transparent to-transparent"
          aria-hidden
        />
        <LoginForm platformName={settings.platformName} loginPageText={settings.loginPageText} />
      </div>
    </div>
  )
}
