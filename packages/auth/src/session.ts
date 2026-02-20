import { prisma } from '@habidat/db'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from './index'

export type SessionUser = {
  id: string
  email: string
  name: string
  username: string
  image: string | null
  location: string | null
  preferredLanguage: string
  preferredColorMode: string | null
  storageQuota: string
  primaryGroupId: string | null
  ldapDn: string | null
  ldapUidNumber: number | null
  createdAt: Date
}

export type SessionWithGroups = {
  user: SessionUser
  memberships: Array<{ groupId: string; group: { id: string; slug: string; name: string } }>
  ownerships: Array<{ groupId: string; group: { id: string; slug: string; name: string } }>
  primaryGroup: { name: string } | null
  isAdmin: boolean
  isGroupAdmin: boolean
}

// Cached session getter - only runs once per request
export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session
})

/** Theme preferences from DB for the current user (used by root layout so theme reflects saved profile). */
export const getCurrentUserThemePreferences = cache(
  async (): Promise<{
    preferredColorMode: string | null
  } | null> => {
    const session = await getSession()
    if (!session?.user?.id) return null
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferredColorMode: true },
    })
    return user ? { preferredColorMode: user.preferredColorMode } : null
  }
)

// Get current user or redirect to login
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession()
  if (!session?.user) {
    redirect('/login')
  }
  return session.user as SessionUser
}

// Get current user with group memberships
export const getCurrentUserWithGroups = cache(async (): Promise<SessionWithGroups | null> => {
  const session = await getSession()
  if (!session?.user) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        include: {
          group: { select: { id: true, slug: true, name: true, isSystem: true } },
        },
      },
      ownerships: {
        include: {
          group: { select: { id: true, slug: true, name: true } },
        },
      },
      primaryGroup: { select: { name: true } },
    },
  })

  if (!user) {
    return null
  }

  // Check if user is in admin group
  const isAdmin = user.memberships.some((m) => m.group.slug === 'admin' && m.group.isSystem)

  // Check if user owns any groups
  const isGroupAdmin = user.ownerships.length > 0 || isAdmin

  return {
    user,
    memberships: user.memberships,
    ownerships: user.ownerships,
    primaryGroup: user.primaryGroup,
    isAdmin,
    isGroupAdmin,
  }
})

// Require user to be logged in and return user with groups
export async function requireUserWithGroups(): Promise<SessionWithGroups> {
  const sessionWithGroups = await getCurrentUserWithGroups()
  if (!sessionWithGroups) {
    redirect('/login')
  }
  return sessionWithGroups
}

// Require user to be an admin
export async function requireAdmin(): Promise<SessionWithGroups> {
  const sessionWithGroups = await requireUserWithGroups()
  if (!sessionWithGroups.isAdmin) {
    throw new Error('Admin access required')
  }
  return sessionWithGroups
}

// Require user to be a group admin (owns at least one group) or admin
export async function requireGroupAdmin(): Promise<SessionWithGroups> {
  const sessionWithGroups = await requireUserWithGroups()
  if (!sessionWithGroups.isGroupAdmin) {
    throw new Error('Group admin access required')
  }
  return sessionWithGroups
}
