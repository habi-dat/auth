export interface DiscourseConfig {
  url: string
  apiKey: string
  apiUsername: string
  ssoSecret: string
}

export interface SsoUserData {
  /** External id for Discourse (use user.discourseId ?? user.username; store after first sync) */
  externalId: string
  email: string
  username: string
  name: string
  title?: string
  /** Group slugs (including parent groups for hierarchy); membership is set via sync_sso only */
  groups?: string[]
}

export interface CreateGroupData {
  slug: string
  name: string
  description: string
}

export interface UpdateGroupData {
  slug?: string
  name?: string
  description?: string
}

// ---------------------------------------------------------------------------
// Categories (Discourse API – no DB storage; full CRUD via API)
// ---------------------------------------------------------------------------

/** Category as returned by Discourse API (list/show). */
export interface DiscourseCategoryApi {
  id: number
  name: string
  slug: string
  color: string
  text_color: string
  parent_category_id?: number | null
  subcategory_count?: number
  subcategory_list?: DiscourseCategoryApi[]
  subcategory_ids?: number[]
  read_restricted?: boolean
  topic_count?: number
  post_count?: number
  position?: number
  description?: string | null
  description_text?: string | null
  can_edit?: boolean
  group_permissions?: Array<{ permission_type: number; group_name: string; group_id: number }>
  [key: string]: unknown
}

/** Payload for creating a category (POST /categories.json). */
export interface CreateCategoryData {
  name: string
  slug?: string
  color?: string
  text_color?: string
  parent_category_id?: number | null
  /** Group slugs → permission level (1 = see). Empty = everyone. */
  permissions?: Record<string, number>
}

/** Payload for updating a category (PUT /categories/{id}.json). */
export interface UpdateCategoryData {
  name?: string
  slug?: string
  color?: string
  text_color?: string
  parent_category_id?: number | null
  permissions?: Record<string, number>
}

/** Response from GET /categories.json */
export interface ListCategoriesResponse {
  category_list: {
    categories: DiscourseCategoryApi[]
    can_create_category?: boolean
    can_create_topic?: boolean
  }
}

/** Response from GET /c/{id}/show.json */
export interface ShowCategoryResponse {
  category: DiscourseCategoryApi
}
