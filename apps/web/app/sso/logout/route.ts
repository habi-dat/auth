import { handleSamlLogout } from '@/lib/sso/saml-logout'

export async function GET(request: Request) {
  return handleSamlLogout(request)
}

export async function POST(request: Request) {
  return handleSamlLogout(request)
}
