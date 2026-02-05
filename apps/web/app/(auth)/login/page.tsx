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
    <div className="rounded-xl border bg-card p-8 shadow-sm w-full max-w-sm mx-auto">
      <LoginForm
        platformName={settings.platformName}
        logoUrl={settings.logoUrl}
        logoUpdatedAt={settings.logoUpdatedAt}
        loginPageText={settings.loginPageText}
      />
    </div>
  )
}
