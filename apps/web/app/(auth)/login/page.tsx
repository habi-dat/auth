import { LoginForm } from '@/components/auth/login-form'
import { Card, CardContent } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <Card className="w-full shadow-lg border-border/60 dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
      <CardContent className="p-8">
        <LoginForm />
      </CardContent>
    </Card>
  )
}
