import type { PrismaClient } from '@habidat/db'

/**
 * Returns the group's slug and all ancestor (parent) group slugs.
 * Uses the same logic as the discourse processor for hierarchy.
 */
export async function getGroupSlugAndAncestorSlugs(
  prisma: PrismaClient,
  groupId: string,
  visited = new Set<string>()
): Promise<string[]> {
  if (visited.has(groupId)) return []
  visited.add(groupId)
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { slug: true },
  })
  const result: string[] = [group.slug]
  const parents = await prisma.groupHierarchy.findMany({
    where: { childGroupId: groupId },
    select: { parentGroupId: true },
  })
  for (const p of parents) {
    const ancestorSlugs = await getGroupSlugAndAncestorSlugs(prisma, p.parentGroupId, visited)
    for (const s of ancestorSlugs) result.push(s)
  }
  return result
}

/**
 * Returns unique group slugs for the given group IDs, including ancestor slugs.
 */
export async function getUserGroupSlugs(
  prisma: PrismaClient,
  groupIds: string[]
): Promise<string[]> {
  const slugs = new Set<string>()
  for (const groupId of groupIds) {
    const groupSlugs = await getGroupSlugAndAncestorSlugs(prisma, groupId)
    for (const s of groupSlugs) slugs.add(s)
  }
  return [...slugs]
}

/**
 * Returns a Set of ancestor (parent) group IDs for the given group IDs.
 * Recursively traverses the hierarchy. Does NOT include the input group IDs themselves.
 */
export async function getAncestorGroupIds(
  prisma: PrismaClient,
  groupIds: string[]
): Promise<Set<string>> {
  const result = new Set<string>()
  const visited = new Set<string>()

  async function collectAncestors(childId: string) {
    if (visited.has(childId)) return
    visited.add(childId)
    const parents = await prisma.groupHierarchy.findMany({
      where: { childGroupId: childId },
      select: { parentGroupId: true },
    })
    for (const p of parents) {
      result.add(p.parentGroupId)
      await collectAncestors(p.parentGroupId)
    }
  }

  for (const groupId of groupIds) {
    await collectAncestors(groupId)
  }
  return result
}
