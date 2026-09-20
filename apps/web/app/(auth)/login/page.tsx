import { AuthCard, AuthCardContent } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <AuthCard>
      <AuthCardContent className="md:p-8">
        <LoginForm />
      </AuthCardContent>
    </AuthCard>
  )
}
