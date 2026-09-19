import { dispatchToNodeHandler } from '@/lib/oidc/http'
import { getOidcProvider } from '@/lib/oidc/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(request: Request) {
  const provider = getOidcProvider()
  return dispatchToNodeHandler(request, provider.callback())
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
export const OPTIONS = handle
