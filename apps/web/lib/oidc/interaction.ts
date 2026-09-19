import { getAncestorGroupIds } from '@habidat/auth/group-slugs'
import { canAccessApp } from '@habidat/auth/roles'
import { getCurrentUserWithGroups } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import { dispatchToNodeHandler } from './http'
import { getOidcProvider } from './provider'

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function handleOidcInteraction(request: Request, uid: string): Promise<Response> {
  const provider = getOidcProvider()

  return dispatchToNodeHandler(request, async (req, res) => {
    try {
      const details = await provider.interactionDetails(req, res)
      if (!details) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('Invalid interaction')
        return
      }

      const sessionWithGroups = await getCurrentUserWithGroups()
      if (!sessionWithGroups) {
        const returnUrl = `${APP_URL}/oidc-interaction/${uid}`
        res.writeHead(302, {
          Location: `/login?callbackUrl=${encodeURIComponent(returnUrl)}`,
        })
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
            res.writeHead(302, { Location: '/unauthorized' })
            res.end()
            return
          }
        }
      }

      await provider.interactionResult(
        req,
        res,
        {
          login: { accountId: sessionWithGroups.user.id },
          consent: {},
        },
        { mergeWithLastSubmission: false }
      )
    } catch (error) {
      console.error('OIDC interaction error:', error)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Interaction error')
      }
    }
  })
}
