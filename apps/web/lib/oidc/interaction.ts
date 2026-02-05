import type { IncomingMessage, ServerResponse } from 'node:http'
import type Provider from 'oidc-provider'
import { auth } from '@/lib/auth'

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function nodeHeadersToWebHeaders(req: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v != null) headers.set(k.toLowerCase(), Array.isArray(v) ? v.join(', ') : v)
  }
  return headers
}

/**
 * Handle OIDC interaction: check better-auth session and complete or redirect to login.
 * Call this when path is /oidc-interaction; req/res are Node's.
 */
export async function handleOidcInteraction(
  provider: Provider,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const details = await provider.interactionDetails(req, res)
    if (!details) {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Invalid interaction')
      return
    }
    const headers = nodeHeadersToWebHeaders(req)
    const session = await auth.api.getSession({ headers })
    if (!session?.user) {
      const returnUrl = `${APP_URL}/oidc-interaction${req.url?.startsWith('?') ? req.url : ''}`
      res.writeHead(302, {
        Location: `/login?callbackUrl=${encodeURIComponent(returnUrl)}`,
        'Content-Type': 'text/html',
      })
      res.end('Redirecting to login...')
      return
    }
    await provider.interactionResult(
      req,
      res,
      {
        login: { accountId: session.user.id },
        consent: {},
      },
      { mergeWithLastSubmission: false }
    )
  } catch (err) {
    console.error('OIDC interaction error:', err)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Interaction error')
  }
}
