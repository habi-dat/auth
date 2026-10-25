import { getAncestorGroupIds } from '@habidat/auth/group-slugs'
import { canAccessApp } from '@habidat/auth/roles'
import type { SessionWithGroups } from '@habidat/auth/session'
import { prisma } from '@habidat/db'

/** App group restrictions for an OIDC client, applied the same way as SAML. */
export async function canUseOidcClient(
  session: SessionWithGroups,
  clientId: string
): Promise<boolean> {
  const app = await prisma.app.findFirst({
    where: { oidcEnabled: true, oidcClientId: clientId },
    include: { groupAccess: true },
  })
  if (!app) return true
  const memberGroupIds = session.memberships.map((m) => m.group.id)
  const ancestorGroupIds = await getAncestorGroupIds(prisma, memberGroupIds)
  return canAccessApp(session, app, ancestorGroupIds)
}
