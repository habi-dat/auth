import { handleSamlLogout } from '@/lib/sso/saml-logout'

export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params
  return handleSamlLogout(request, appSlug)
}

export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params
  return handleSamlLogout(request, appSlug)
}
