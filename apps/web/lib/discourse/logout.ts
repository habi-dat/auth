import { getCurrentUserWithGroups } from '@habidat/auth/session'
import { getDiscourseClient } from './client'

/** Best-effort: end the current user's Discourse session. Never throws. */
export async function logoutCurrentUserFromDiscourse(): Promise<void> {
  const discourse = getDiscourseClient()
  if (!discourse) return

  try {
    const session = await getCurrentUserWithGroups()
    const username = session?.user.username
    if (!username) return
    await discourse.logOutUserByUsername(username)
  } catch (e) {
    console.warn('Could not log out Discourse session:', e)
  }
}
