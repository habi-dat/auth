import {
  getSession,
  requireAdmin,
  requireGroupAdmin,
  requireUserWithGroups,
} from '@habidat/auth/session'
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient } from 'next-safe-action'

// Base action client with error handling
export const actionClient = createSafeActionClient({
  handleServerError(e) {
    console.error('Action error:', e.message)

    if (e instanceof Error) {
      return e.message
    }

    return DEFAULT_SERVER_ERROR_MESSAGE
  },
})

// Action client that requires authentication
export const authAction = actionClient.use(async ({ next }) => {
  const session = await getSession()

  if (!session?.user) {
    throw new Error('Not authenticated')
  }

  return next({ ctx: { userId: session.user.id } })
})

// Action client that requires full user context with groups
export const userAction = actionClient.use(async ({ next }) => {
  const sessionWithGroups = await requireUserWithGroups()

  return next({ ctx: { session: sessionWithGroups } })
})

// Action client that requires admin
export const adminAction = actionClient.use(async ({ next }) => {
  const sessionWithGroups = await requireAdmin()

  return next({ ctx: { session: sessionWithGroups } })
})

// Action client that requires group admin
export const groupAdminAction = actionClient.use(async ({ next }) => {
  const sessionWithGroups = await requireGroupAdmin()

  return next({ ctx: { session: sessionWithGroups } })
})
