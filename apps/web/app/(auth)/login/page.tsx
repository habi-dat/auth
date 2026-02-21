import { LoginForm } from '@/components/auth/login-form'
import { Card, CardContent } from '@/components/ui/card'
import { getGeneralSettings } from '@/lib/settings/general'

export default async function LoginPage() {
  const settings = await getGeneralSettings().catch(() => ({
    platformName: undefined,
    loginPageText: undefined,
  }))

  return (
    <Card className="w-full shadow-lg border-border/60 dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
      <CardContent className="p-8">
        <LoginForm platformName={settings.platformName} loginPageText={settings.loginPageText} />
      </CardContent>
    </Card>
  )
}
