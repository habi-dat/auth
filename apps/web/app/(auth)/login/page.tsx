import { LoginForm } from '@/components/auth/login-form'
import { getGeneralSettings } from '@/lib/settings/general'

export default async function LoginPage() {
  const settings = await getGeneralSettings().catch(() => ({
    platformName: undefined,
    logoUrl: undefined,
    logoUpdatedAt: undefined,
    loginPageText: undefined,
  }))

  return (
    <div className="relative w-full max-w-sm mx-auto rounded-2xl border border-border/80 bg-card/95 p-8 shadow-xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5 backdrop-blur-sm overflow-hidden">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/8 via-transparent to-transparent" aria-hidden />
      <LoginForm
        platformName={settings.platformName}
        logoUrl={settings.logoUrl}
        logoUpdatedAt={settings.logoUpdatedAt}
        loginPageText={settings.loginPageText}
      />
    </div>
  )
}
