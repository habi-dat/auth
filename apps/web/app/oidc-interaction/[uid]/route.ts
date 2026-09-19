import { handleOidcInteraction } from '@/lib/oidc/interaction'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(request: Request, context: { params: Promise<{ uid: string }> }) {
  const { uid } = await context.params
  return handleOidcInteraction(request, uid)
}

export const GET = handle
export const POST = handle
