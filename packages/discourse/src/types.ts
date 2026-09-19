export interface DiscourseConfig {
  url: string
  apiKey: string
  apiUsername: string
  ssoSecret: string
}

/**
 * DiscourseConnect / sync_sso external_id.
 * Freeze `discourseId` after first link; otherwise use username (LDAP uid),
 * which is what the Nextcloud discoursesso plugin sent.
 */
export function resolveDiscourseExternalId(user: {
  discourseId?: string | null
  username: string
}): string {
  return user.discourseId || user.username
}

export interface SsoUserData {
  /** External id for Discourse (see resolveDiscourseExternalId) */
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

// ---------------------------------------------------------------------------
// User mail / notification settings
// ---------------------------------------------------------------------------

/** Category as returned when fetching as a specific user – includes their notification level. */
export interface DiscourseCategoryWithNotification extends DiscourseCategoryApi {
  notification_level: 0 | 1 | 2 | 3 | 4
  email_in?: string | null
}

/** Tag names must not be empty or contain commas (watched_tags is a CSV). */
export const DISCOURSE_TAG_NAME = /^[^\s,]{1,100}$/

export function isDiscourseTagName(name: string): boolean {
  return DISCOURSE_TAG_NAME.test(name)
}

/** Single tag as returned by GET /tags.json */
export interface DiscourseTagBasic {
  id: string
  name: string
  count: number
  description?: string | null
}

/** Tag notification entry as returned by GET /tag-notifications.json */
export interface DiscourseTagNotification {
  tag_name: string
  notification_level: 0 | 1 | 2 | 3 | 4
}

/** Group with user's notification level as returned by GET /groups.json (acted as user). */
export interface DiscourseGroupBasic {
  id: number
  name: string
  display_name: string
  notification_level: 0 | 1 | 2 | 3 | 4
  automatic?: boolean
  bio_excerpt?: string | null
  incoming_email?: string | null
}

/** Mail-related fields from a single GET /u/{username}.json */
export interface DiscourseUserMailProfile {
  mailingListMode: boolean
  echoOwnPosts: boolean
  tagNotifications: DiscourseTagNotification[]
  groups: DiscourseGroupBasic[]
}
