import type { SessionWithGroups } from './session'

type GroupMembership = {
  groupId: string
  group?: { id: string; slug: string; name: string }
}

// Check if user is admin
export function isAdmin(session: SessionWithGroups): boolean {
  return session.isAdmin
}

// Check if user is group admin for any group
export function isGroupAdmin(session: SessionWithGroups): boolean {
  return session.isGroupAdmin
}

// Check if user can manage a specific group
export function canManageGroup(session: SessionWithGroups, groupId: string): boolean {
  // Admins can manage any group
  if (session.isAdmin) return true

  // Check if user owns this group
  return session.ownerships.some((o) => o.groupId === groupId)
}

// Check if user can manage a specific user based on group memberships
export function canManageUser(
  session: SessionWithGroups,
  userMemberships: GroupMembership[]
): boolean {
  // Admins can manage any user
  if (session.isAdmin) return true

  // Check if user owns any of the target user's groups
  const userGroupIds = userMemberships.map((m) => m.groupId)
  return session.ownerships.some((o) => userGroupIds.includes(o.groupId))
}

// Get list of group IDs that the user can manage
export function getManagedGroupIds(session: SessionWithGroups): string[] {
  if (session.isAdmin) {
    // Return empty array to indicate "all groups" - caller should handle this
    return []
  }
  return session.ownerships.map((o) => o.groupId)
}

// Check if user is a member of a specific group
export function isMemberOfGroup(session: SessionWithGroups, groupId: string): boolean {
  return session.memberships.some((m) => m.groupId === groupId)
}

// Check if user owns a specific group
export function isOwnerOfGroup(session: SessionWithGroups, groupId: string): boolean {
  return session.ownerships.some((o) => o.groupId === groupId) || session.isAdmin
}

/** App with groupAccess for canAccessApp */
export type AppWithGroupAccess = {
  id: string
  slug: string
  groupAccess: Array<{ groupId: string }>
}

/**
 * Check if user can access an app. Empty groupAccess = all users.
 * Pass `ancestorGroupIds` to include parent groups resolved from the hierarchy.
 */
export function canAccessApp(
  session: SessionWithGroups,
  app: AppWithGroupAccess,
  ancestorGroupIds?: Set<string>
): boolean {
  if (app.groupAccess.length === 0) return true
  if (session.isAdmin) return true
  const allowedGroupIds = app.groupAccess.map((a) => a.groupId)
  const userGroupIds = new Set([
    ...session.memberships.map((m) => m.groupId),
    ...session.ownerships.map((o) => o.groupId),
  ])
  if (ancestorGroupIds) {
    for (const id of ancestorGroupIds) userGroupIds.add(id)
  }
  return allowedGroupIds.some((gid) => userGroupIds.has(gid))
}
