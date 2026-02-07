'use server'

import { getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'

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
