import type { IncomingMessage, ServerResponse } from 'node:http'
import { getAncestorGroupIds } from '@habidat/auth/group-slugs'
import { canAccessApp } from '@habidat/auth/roles'
import { getCurrentUserWithGroups, getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import type Provider from 'oidc-provider'
import { dispatchToNodeHandler } from './http'
import { demandsFreshPassword, promptValues, sessionIsFresh } from './policy'
import { getOidcProvider } from './provider'
import { markOidcReauth, oidcReauthMark } from './store'

type InteractionDetails = Awaited<ReturnType<Provider['interactionDetails']>>

type OidcGrant = {
  addOIDCScope: (scope: string) => void
  addOIDCClaims: (claims: string[]) => void
  save: () => Promise<string>
}

type GrantModel = {
  find: (id: string) => Promise<OidcGrant | undefined>
  new (args: { accountId: string; clientId: string }): OidcGrant
}

/**
 * An empty consent result does not grant openid/profile/email. The authorize
 * resume then asks for consent again and the browser loops on this page.
 */
async function finishOidcLogin(
  provider: Provider,
  details: InteractionDetails,
  accountId: string,
  req: IncomingMessage,
  res: ServerResponse
) {
  const clientId = details.params.client_id
  if (typeof clientId !== 'string' || !clientId) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing client_id')
    return
  }

  const Grant = (provider as Provider & { Grant: GrantModel }).Grant
  let grant = details.grantId ? await Grant.find(details.grantId) : undefined
  if (!grant) {
    grant = new Grant({ accountId, clientId })
  }

  const requestedScope = typeof details.params.scope === 'string' ? details.params.scope : 'openid'
  grant.addOIDCScope(requestedScope)
  const promptDetails = (details.prompt?.details ?? {}) as {
    missingOIDCScope?: string[]
    missingOIDCClaims?: string[]
  }
  if (promptDetails.missingOIDCScope?.length) {
    grant.addOIDCScope(promptDetails.missingOIDCScope.join(' '))
  }
  if (promptDetails.missingOIDCClaims?.length) {
    grant.addOIDCClaims(promptDetails.missingOIDCClaims)
  }

  const grantId = await grant.save()
  await provider.interactionFinished(
    req,
    res,
    {
      login: { accountId },
      consent: { grantId },
    },
    { mergeWithLastSubmission: true }
  )
}

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function loginLocation(uid: string, reauth: boolean): string {
  const returnUrl = `${APP_URL}/oidc-interaction/${uid}`
  const params = new URLSearchParams({ callbackUrl: returnUrl })
  if (reauth) params.set('reauth', '1')
  return `/login?${params.toString()}`
}

function sessionCreatedAt(
  session: { session?: { createdAt?: Date | string } } | null
): Date | null {
  const value = session?.session?.createdAt
  if (!value) return null
  const createdAt = new Date(value)
  return Number.isNaN(createdAt.getTime()) ? null : createdAt
}

function sessionId(session: { session?: { id?: string } } | null): string | null {
  return session?.session?.id ?? null
}

async function finishOidcError(
  provider: Provider,
  req: IncomingMessage,
  res: ServerResponse,
  error: 'login_required' | 'access_denied' | 'server_error',
  errorDescription: string
) {
  await provider.interactionFinished(
    req,
    res,
    { error, error_description: errorDescription },
    { mergeWithLastSubmission: false }
  )
}

function isNextSoftNavigation(request: Request): boolean {
  if (request.headers.get('rsc') === '1') return true
  return new URL(request.url).searchParams.has('_rsc')
}

export async function handleOidcInteraction(request: Request, uid: string): Promise<Response> {
  // A soft navigation would run this one-time interaction inside a fetch and
  // then load the same URL again as a document, which can no longer find it.
  // A non-RSC response makes the Next.js client fall back to a full page load.
  if (isNextSoftNavigation(request)) {
    return new Response('oidc', {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  }

  const provider = getOidcProvider()

  return dispatchToNodeHandler(request, async (req, res) => {
    try {
      const details = await provider.interactionDetails(req, res)
      if (!details) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('Invalid interaction')
        return
      }

      const authSession = await getSession()
      const sessionWithGroups = authSession?.user ? await getCurrentUserWithGroups() : null
      const prompts = promptValues(details.params.prompt)
      const reasons = details.prompt?.reasons
      const freshPassword = demandsFreshPassword(reasons)
      const reauth = oidcReauthMark(uid)
      const freshSession = sessionIsFresh({
        sessionId: sessionId(authSession),
        createdAt: sessionCreatedAt(authSession),
        markedSessionId: reauth?.sessionId,
        markedAt: reauth?.markedAt,
      })

      // prompt=none must not show a page. The provider already does this on the
      // authorization request; this covers a resume that still carries none.
      if (prompts.has('none') && (!sessionWithGroups || (freshPassword && !freshSession))) {
        await finishOidcError(
          provider,
          req,
          res,
          'login_required',
          'End-User authentication is required'
        )
        return
      }

      if (freshPassword && !freshSession) {
        if (!reauth) markOidcReauth(uid, sessionId(authSession))
        res.writeHead(302, { Location: loginLocation(uid, true) })
        res.end()
        return
      }

      if (!sessionWithGroups) {
        res.writeHead(302, { Location: loginLocation(uid, false) })
        res.end()
        return
      }

      const clientId = details.params.client_id
      if (typeof clientId === 'string') {
        const app = await prisma.app.findFirst({
          where: { oidcEnabled: true, oidcClientId: clientId },
          include: { groupAccess: true },
        })
        if (app) {
          const memberGroupIds = sessionWithGroups.memberships.map((m) => m.group.id)
          const ancestorGroupIds = await getAncestorGroupIds(prisma, memberGroupIds)
          if (!canAccessApp(sessionWithGroups, app, ancestorGroupIds)) {
            await finishOidcError(
              provider,
              req,
              res,
              'access_denied',
              'You are not allowed to use this application'
            )
            return
          }
        }
      }

      await finishOidcLogin(provider, details, sessionWithGroups.user.id, req, res)
    } catch (error) {
      console.error('OIDC interaction error:', error)
      if (!res.headersSent) {
        try {
          await finishOidcError(provider, req, res, 'server_error', 'Interaction error')
        } catch {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Interaction error')
        }
      }
    }
  })
}
