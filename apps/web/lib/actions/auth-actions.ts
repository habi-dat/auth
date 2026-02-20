'use server'

import { getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'

export type ResolveLoginResult =
  | { email: string }
  | { email: null; suggestedUsernames?: string[] }

/**
 * Given a username, return the associated email address.
 * If no user matches by username, fall back to a name search and
 * return suggested usernames so the caller can hint the user.
 */
export async function resolveLoginEmail(
  identity: string
): Promise<ResolveLoginResult> {
  const byUsername = await prisma.user.findUnique({
    where: { username: identity },
    select: { email: true },
  })
  if (byUsername) return { email: byUsername.email }

  const byName = await prisma.user.findMany({
    where: { name: { equals: identity, mode: 'insensitive' } },
    select: { username: true },
    take: 5,
  })
  if (byName.length > 0) {
    return { email: null, suggestedUsernames: byName.map((u) => u.username) }
  }

  return { email: null }
}

export async function getLogoutUrlAction() {
  const sessionData = await getSession()
  if (!sessionData?.session) {
    return { logoutUrl: null }
  }

  const session = sessionData.session as { id: string }
  const samlCount = await prisma.samlSessionApp.count({
    where: { sessionId: session.id },
  })

  if (samlCount > 0) {
    // Redirect to the logout route.
    // The "init" slug is a placeholder; initiateLogoutFlow ignores it
    // and looks up the sessions from the DB.
    return { logoutUrl: '/sso/logout/init' }
  }

  return { logoutUrl: null }
}
