'use server'

import type {
  CreateCategoryData,
  DiscourseCategoryApi,
  UpdateCategoryData,
} from '@habidat/discourse'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { adminAction } from '@/lib/actions/client'
import { getDiscourseClient } from '@/lib/discourse/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

/** Fetch editable categories from Discourse API with full details (including group_permissions). Excludes system categories (can_edit === false). Returns null if Discourse not configured. */
export async function getCategories(): Promise<DiscourseCategoryApi[] | null> {
  const client = getDiscourseClient()
  if (!client) return null
  const list = await client.listCategories(true)
  const editable = list.filter((c) => c.can_edit !== false)
  const withDetails = await Promise.all(editable.map((c) => client.getCategory(c.id)))
  return withDetails
}

/** Fetch a single category by id (includes group_permissions). Returns null if Discourse not configured. */
export async function getCategory(id: number): Promise<DiscourseCategoryApi | null> {
  const client = getDiscourseClient()
  if (!client) return null
  try {
    return await client.getCategory(id)
  } catch {
    return null
  }
}

const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  color: z
    .string()
    .regex(/^[0-9a-fA-F]{6}$/)
    .optional(),
  text_color: z
    .string()
    .regex(/^[0-9a-fA-F]{6}$/)
    .optional(),
  parent_category_id: z.number().int().positive().optional().nullable(),
  group_ids: z.array(z.string().cuid()).optional(),
})

const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.number().int().positive(),
})

function groupIdsToSlugs(groupIds: string[] | undefined, slugById: Map<string, string>): string[] {
  if (!groupIds?.length) return []
  return groupIds.map((id) => slugById.get(id)).filter((s): s is string => !!s)
}

/** Discourse permissions: empty groups = everyone can see (everyone: 1); otherwise group slugs → permission level 1 (see). */
function buildPermissions(groupSlugs: string[]): Record<string, number> {
  if (groupSlugs.length === 0) {
    return { everyone: 1 }
  }
  return Object.fromEntries(groupSlugs.map((s) => [s, 1]))
}

export const createCategoryAction = adminAction
  .schema(createCategorySchema)
  .action(async ({ parsedInput }) => {
    const client = getDiscourseClient()
    if (!client) throw new Error('Discourse is not configured')
    const groups = await getGroupsForSelect()
    const slugById = new Map(groups.map((g) => [g.id, g.slug]))
    const groupSlugs = groupIdsToSlugs(parsedInput.group_ids, slugById)
    const data: CreateCategoryData = {
      name: parsedInput.name,
      color: parsedInput.color ?? '0088cc',
      text_color: parsedInput.text_color ?? 'ffffff',
      permissions: buildPermissions(groupSlugs),
    }
    if (parsedInput.slug) data.slug = parsedInput.slug
    if (parsedInput.parent_category_id != null)
      data.parent_category_id = parsedInput.parent_category_id
    const id = await client.createCategory(data)
    revalidatePath('/categories')
    return { id }
  })

export const updateCategoryAction = adminAction
  .schema(updateCategorySchema)
  .action(async ({ parsedInput }) => {
    const client = getDiscourseClient()
    if (!client) throw new Error('Discourse is not configured')
    const { id, group_ids, ...rest } = parsedInput
    const data: UpdateCategoryData = {}
    if (rest.name != null) data.name = rest.name
    if (rest.slug != null) data.slug = rest.slug
    if (rest.color != null) data.color = rest.color
    if (rest.text_color != null) data.text_color = rest.text_color
    if (rest.parent_category_id !== undefined) data.parent_category_id = rest.parent_category_id
    if (group_ids !== undefined) {
      const groups = await getGroupsForSelect()
      const slugById = new Map(groups.map((g) => [g.id, g.slug]))
      const groupSlugs = groupIdsToSlugs(group_ids, slugById)
      data.permissions = buildPermissions(groupSlugs)
    }
    await client.updateCategory(id, data)
    revalidatePath('/categories')
    return { id }
  })

const deleteCategorySchema = z.object({ id: z.number().int().positive() })

export const deleteCategoryAction = adminAction
  .schema(deleteCategorySchema)
  .action(async ({ parsedInput }) => {
    const client = getDiscourseClient()
    if (!client) throw new Error('Discourse is not configured')
    await client.deleteCategory(parsedInput.id)
    revalidatePath('/categories')
    return { id: parsedInput.id }
  })
