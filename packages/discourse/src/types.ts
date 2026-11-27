export interface DiscourseConfig {
  url: string
  apiKey: string
  apiUsername: string
  ssoSecret: string
}

/**
 * DiscourseConnect / sync_sso external_id.
 * Freeze `discourseId` after first link; otherwise use username (LDAP uid),
 * matching historical DiscourseConnect payloads.
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
  /** Absolute URL Discourse should fetch (sync_sso / DiscourseConnect). */
  avatarUrl?: string
  /** Force Discourse to refresh the avatar even if the URL is unchanged. */
  avatarForceUpdate?: boolean
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

/** Flatten `subcategory_list` to any depth (Discourse only sends one nested array per node). */
export function flattenCategoryList<T extends { subcategory_list?: T[] }>(categories: T[]): T[] {
  const flat: T[] = []
  for (const cat of categories) {
    flat.push(cat)
    const subs = cat.subcategory_list
    if (subs && subs.length > 0) {
      for (const nested of flattenCategoryList(subs)) {
        flat.push(nested)
      }
    }
  }
  return flat
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

/** Discourse notification level: 0 muted, 1 regular, 2 tracking, 3 watching, 4 watching first post. */
export type DiscourseNotificationLevel = 0 | 1 | 2 | 3 | 4

export const NOTIFICATION_LEVEL_MUTED = 0
export const NOTIFICATION_LEVEL_REGULAR = 1
export const NOTIFICATION_LEVEL_WATCHING = 3

/** Values of Discourse `user_option.mailing_list_mode_frequency` (UserOption.mailing_list_mode_frequencies). */
export const MAILING_LIST_FREQUENCY = {
  daily: 0,
  /** One mail per post, including the user's own posts. */
  individual: 1,
  individualExcludingOwn: 2,
} as const

/** Own posts are only suppressed for "individual_excluding_own"; default is "individual". */
export function echoOwnPostsFromFrequency(frequency: number | undefined): boolean {
  return frequency !== MAILING_LIST_FREQUENCY.individualExcludingOwn
}

/** Always one mail per post (never the daily digest); only own posts are optional. */
export function frequencyForEchoOwnPosts(echo: boolean): number {
  return echo ? MAILING_LIST_FREQUENCY.individual : MAILING_LIST_FREQUENCY.individualExcludingOwn
}

/** Category as returned when fetching as a specific user – includes their notification level. */
export interface DiscourseCategoryWithNotification extends DiscourseCategoryApi {
  notification_level: DiscourseNotificationLevel
  email_in?: string | null
}

/** Tag names must not be empty or contain commas (watched_tags is a CSV). */
export const DISCOURSE_TAG_NAME = /^[^\s,]{1,100}$/

export function isDiscourseTagName(name: string): boolean {
  return DISCOURSE_TAG_NAME.test(name)
}

/** Read-modify-write helper for Discourse `watched_tags` CSV lists. */
export function mergeWatchedTags(current: string[], tagName: string, watching: boolean): string[] {
  const without = current.filter((t) => t !== tagName)
  return watching ? [...without, tagName] : without
}

/**
 * Subscribing watches a tag, unsubscribing mutes it. A tag is never in both lists.
 */
export function mergeTagSubscription(
  lists: { watched: string[]; muted: string[] },
  tagName: string,
  subscribed: boolean
): { watched: string[]; muted: string[] } {
  return {
    watched: mergeWatchedTags(lists.watched, tagName, subscribed),
    muted: mergeWatchedTags(lists.muted, tagName, !subscribed),
  }
}

/** Discourse returns tag lists as names or `{ name }` objects depending on version. */
export type DiscourseTagListEntry = string | { name: string }

export function tagNames(entries: DiscourseTagListEntry[] | undefined): string[] {
  return (entries ?? []).map((e) => (typeof e === 'string' ? e : e.name))
}

/** Single tag as returned by GET /tags.json */
export interface DiscourseTagBasic {
  id: string
  name: string
  count: number
  description?: string | null
  staff?: boolean
}

/** Tag notification entry as returned by GET /tag-notifications.json */
export interface DiscourseTagNotification {
  tag_name: string
  notification_level: DiscourseNotificationLevel
}

/** Group with user's notification level as returned by GET /groups.json (acted as user). */
export interface DiscourseGroupBasic {
  id: number
  name: string
  display_name: string
  notification_level: DiscourseNotificationLevel
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

/** Subset of GET /u/{username}.json used for mail settings. */
export interface DiscourseUserMailResponse {
  user_option?: { mailing_list_mode?: boolean; mailing_list_mode_frequency?: number }
  watched_tags?: DiscourseTagListEntry[]
  muted_tags?: DiscourseTagListEntry[]
  groups?: Array<Omit<DiscourseGroupBasic, 'notification_level'>>
  group_users?: Array<{ group_id: number; notification_level: number }>
}

export function parseUserMailProfile(user: DiscourseUserMailResponse | undefined): DiscourseUserMailProfile {
  const opt = user?.user_option
  const levelByGroupId = new Map(
    (user?.group_users ?? []).map((gu) => [gu.group_id, gu.notification_level as DiscourseNotificationLevel])
  )

  return {
    mailingListMode: opt?.mailing_list_mode ?? false,
    echoOwnPosts: echoOwnPostsFromFrequency(opt?.mailing_list_mode_frequency),
    tagNotifications: [
      ...tagNames(user?.watched_tags).map((tag_name): DiscourseTagNotification => ({
        tag_name,
        notification_level: NOTIFICATION_LEVEL_WATCHING,
      })),
      ...tagNames(user?.muted_tags).map((tag_name): DiscourseTagNotification => ({
        tag_name,
        notification_level: NOTIFICATION_LEVEL_MUTED,
      })),
    ],
    groups: (user?.groups ?? [])
      .filter((g) => !g.automatic)
      .map((g) => ({
        ...g,
        notification_level: levelByGroupId.get(g.id) ?? NOTIFICATION_LEVEL_REGULAR,
      })),
  }
}
