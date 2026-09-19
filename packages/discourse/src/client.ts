import { createHmac } from 'node:crypto'
import type {
  CreateCategoryData,
  CreateGroupData,
  DiscourseCategoryApi,
  DiscourseCategoryWithNotification,
  DiscourseConfig,
  DiscourseGroupBasic,
  DiscourseTagBasic,
  DiscourseTagNotification,
  ListCategoriesResponse,
  ShowCategoryResponse,
  SsoUserData,
  UpdateCategoryData,
  UpdateGroupData,
} from './types'

export class DiscourseService {
  private config: DiscourseConfig

  constructor(config: DiscourseConfig) {
    this.config = config
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = this.config.url.replace(/\/$/, '')
    const url = path.startsWith('http')
      ? path
      : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Api-Key': this.config.apiKey,
        'Api-Username': this.config.apiUsername,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Discourse API error: ${response.status} - ${error}`)
    }

    const text = await response.text()
    if (!text.trim()) return undefined as T
    return JSON.parse(text) as T
  }

  /**
   * Fetch group by slug. Returns the Discourse group id if found, null if 404.
   */
  async getGroupBySlug(slug: string): Promise<number | null> {
    try {
      const result = await this.request<{ group: { id: number } }>(
        `/groups/${encodeURIComponent(slug)}.json`
      )
      return result?.group?.id ?? null
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('404')) return null
      throw err
    }
  }

  /**
   * Sync user via SSO. Pass externalId from resolveDiscourseExternalId
   * (discourseId ?? username) and persist it on the user after first sync.
   * groups = group slugs (include parent groups for hierarchy).
   */
  async syncUserViaSso(user: SsoUserData): Promise<void> {
    const payload = this.buildSsoPayload(user)
    const sig = this.signPayload(payload)

    await this.request('/admin/users/sync_sso', {
      method: 'POST',
      body: JSON.stringify({ sso: payload, sig }),
    })
  }

  private buildSsoPayload(user: SsoUserData): string {
    const params = new URLSearchParams({
      external_id: user.externalId,
      email: user.email,
      username: user.username,
      name: user.name,
      ...(user.title != null && user.title !== '' && { title: user.title }),
      ...(user.groups != null && user.groups.length > 0 && { groups: user.groups.join(',') }),
    })
    return Buffer.from(params.toString()).toString('base64')
  }

  private signPayload(payload: string): string {
    return createHmac('sha256', this.config.ssoSecret).update(payload).digest('hex')
  }

  async deleteUser(
    username: string
  ): Promise<{ deleted?: boolean; suspended?: boolean; notFound?: boolean }> {
    let user: { user: { id: number } }
    try {
      user = await this.request<{ user: { id: number } }>(`/u/${encodeURIComponent(username)}.json`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('404')) return { notFound: true }
      throw err
    }

    try {
      await this.request(`/admin/users/${user.user.id}.json`, {
        method: 'DELETE',
        body: JSON.stringify({
          delete_posts: false,
          block_email: false,
          block_urls: false,
          block_ip: false,
        }),
      })
      return { deleted: true }
    } catch {
      try {
        await this.logOutUser(user.user.id)

        await this.request(`/admin/users/${user.user.id}/suspend.json`, {
          method: 'PUT',
          body: JSON.stringify({
            suspend_until: '3018-01-01',
            reason: 'Account deleted from habidat-auth',
          }),
        })
        return { suspended: true }
      } catch (e) {
        console.warn(`Could not delete or suspend Discourse user ${username}:`, e)
        throw e
      }
    }
  }

  async logOutUser(userId: number): Promise<void> {
    try {
      await this.request(`/admin/users/${userId}/log_out.json`, {
        method: 'POST',
      })
    } catch (e) {
      console.warn(`Could not log out Discourse user (id: ${userId}):`, e)
    }
  }

  async findUserByEmail(email: string): Promise<{ username: string; id: number } | null> {
    try {
      // Discourse email lookups are available in active and suspended lists
      const [activeResult, suspendedResult] = await Promise.all([
        this.request<{ username: string; id: number }[]>(
          `/admin/users/list/active.json?email=${encodeURIComponent(email)}`
        ),
        this.request<{ username: string; id: number }[]>(
          `/admin/users/list/suspended.json?email=${encodeURIComponent(email)}`
        ),
      ])

      const activeMatch = activeResult?.[0]
      if (activeMatch) return activeMatch

      const suspendedMatch = suspendedResult?.[0]
      if (suspendedMatch) return suspendedMatch

      return null
    } catch (e) {
      console.warn(`Failed to find discourse user by email (${email}):`, e)
      return null
    }
  }

  async unsuspendUser(userId: number): Promise<void> {
    try {
      await this.request(`/admin/users/${userId}/unsuspend.json`, {
        method: 'PUT',
      })
    } catch (e) {
      console.warn(`Could not unsuspend Discourse user (id: ${userId}):`, e)
    }
  }

  /**
   * Create group with required basic settings.
   */
  async createGroup(group: CreateGroupData): Promise<number> {
    const result = await this.request<{ basic_group: { id: number } }>('/admin/groups', {
      method: 'POST',
      body: JSON.stringify({
        group: {
          name: group.slug,
          full_name: group.name,
          bio_raw: group.description ?? '',
          alias_level: 3,
          automatic: false,
          automatic_membership_email_domains: '',
          mentionable_level: 3,
          messageable_level: 3,
          grant_trust_level: 0,
          primary_group: false,
          visible: true,
        },
      }),
    })
    return result.basic_group.id
  }

  async updateGroup(discourseId: number, group: UpdateGroupData): Promise<void> {
    await this.request(`/groups/${discourseId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        group: {
          ...(group.slug != null && { name: group.slug }),
          ...(group.name != null && { full_name: group.name }),
          ...(group.description != null && { bio_raw: group.description }),
        },
      }),
    })
  }

  async deleteGroup(discourseId: number): Promise<void> {
    await this.request(`/admin/groups/${discourseId}.json`, {
      method: 'DELETE',
    })
  }

  // -------------------------------------------------------------------------
  // Categories (full CRUD via Discourse API; no DB)
  // -------------------------------------------------------------------------

  /**
   * List categories (and subcategories if include_subcategories=true).
   * Returns a flat list: top-level categories plus all subcategories from each category's subcategory_list.
   * GET /categories.json
   */
  async listCategories(includeSubcategories = true): Promise<DiscourseCategoryApi[]> {
    const q = includeSubcategories ? '?include_subcategories=true' : ''
    const result = await this.request<ListCategoriesResponse>(`/categories.json${q}`)
    const topLevel = result?.category_list?.categories ?? []
    if (!includeSubcategories) return topLevel
    const flat: DiscourseCategoryApi[] = []
    for (const cat of topLevel) {
      flat.push(cat)
      const subs = cat.subcategory_list ?? []
      for (const sub of subs) flat.push(sub)
    }
    return flat
  }

  /**
   * Get a single category by id.
   * GET /c/{id}/show.json
   */
  async getCategory(id: number): Promise<DiscourseCategoryApi> {
    const result = await this.request<ShowCategoryResponse>(`/c/${id}/show.json`)
    if (!result?.category) throw new Error('Category not found')
    return result.category
  }

  /**
   * Create a category.
   * POST /categories.json
   */
  async createCategory(data: CreateCategoryData): Promise<number> {
    const body: Record<string, unknown> = {
      name: data.name,
      color: data.color ?? '0088cc',
      text_color: data.text_color ?? 'ffffff',
    }
    if (data.slug != null) body.slug = data.slug
    if (data.parent_category_id != null) body.parent_category_id = data.parent_category_id
    if (data.permissions != null && Object.keys(data.permissions).length > 0) {
      body.permissions = data.permissions
    }
    const result = await this.request<{ category: { id: number } }>('/categories.json', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return result.category.id
  }

  /**
   * Update a category.
   * PUT /categories/{id}.json
   */
  async updateCategory(id: number, data: UpdateCategoryData): Promise<void> {
    const body: Record<string, unknown> = {}
    if (data.name != null) body.name = data.name
    if (data.slug != null) body.slug = data.slug
    if (data.color != null) body.color = data.color
    if (data.text_color != null) body.text_color = data.text_color
    if (data.parent_category_id !== undefined) body.parent_category_id = data.parent_category_id
    if (data.permissions != null) body.permissions = data.permissions
    await this.request(`/categories/${id}.json`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  /**
   * Delete a category. Requires admin. May not be available on all Discourse versions.
   * DELETE /categories/{id}.json
   */
  async deleteCategory(id: number): Promise<void> {
    await this.request(`/categories/${id}.json`, {
      method: 'DELETE',
    })
  }

  // -------------------------------------------------------------------------
  // User mail / notification settings (act as the user via Api-Username header)
  // -------------------------------------------------------------------------

  /** Returns mailing list mode and frequency (0=echo own posts, 1=no echo). GET /u/{username}.json */
  async getUserMailingListOptions(
    username: string
  ): Promise<{ mailingListMode: boolean; echoOwnPosts: boolean }> {
    const result = await this.request<{
      user: { user_option?: { mailing_list_mode?: boolean; mailing_list_mode_frequency?: number } }
    }>(`/u/${encodeURIComponent(username)}.json`)
    const opt = result?.user?.user_option
    return {
      mailingListMode: opt?.mailing_list_mode ?? false,
      echoOwnPosts: (opt?.mailing_list_mode_frequency ?? 1) === 0,
    }
  }

  /** @deprecated Use getUserMailingListOptions */
  async getUserMailingListMode(username: string): Promise<boolean> {
    return (await this.getUserMailingListOptions(username)).mailingListMode
  }

  /** Enable or disable mailing list mode for a user. PUT /u/{username} */
  async setUserMailingListMode(username: string, enabled: boolean): Promise<void> {
    await this.request(`/u/${encodeURIComponent(username)}`, {
      method: 'PUT',
      headers: { 'Api-Username': username },
      body: JSON.stringify({ mailing_list_mode: enabled }),
    })
  }

  /** Set mailing list frequency: 0 = echo own posts, 1 = no own posts. PUT /u/{username} */
  async setMailingListEchoOwnPosts(username: string, echo: boolean): Promise<void> {
    await this.request(`/u/${encodeURIComponent(username)}`, {
      method: 'PUT',
      headers: { 'Api-Username': username },
      body: JSON.stringify({ mailing_list_mode_frequency: echo ? 0 : 1 }),
    })
  }

  /**
   * List all categories including the acting user's notification level for each.
   * GET /categories.json (called as the target user via Api-Username)
   */
  async getCategoriesWithNotifications(username: string): Promise<DiscourseCategoryWithNotification[]> {
    const result = await this.request<ListCategoriesResponse>(
      '/categories.json?include_subcategories=true',
      { headers: { 'Api-Username': username } }
    )
    const topLevel = result?.category_list?.categories ?? []
    const flat: DiscourseCategoryWithNotification[] = []
    for (const cat of topLevel) {
      flat.push(cat as DiscourseCategoryWithNotification)
      for (const sub of cat.subcategory_list ?? []) {
        flat.push(sub as DiscourseCategoryWithNotification)
      }
    }
    return flat
  }

  /**
   * Set notification level for a category for the given user.
   * POST /category/{id}/notifications (called as the target user)
   * level: 3 = watching (subscribed), 1 = regular (unsubscribed)
   */
  async setCategoryNotificationLevel(
    username: string,
    categoryId: number,
    level: 0 | 1 | 3
  ): Promise<void> {
    await this.request(`/category/${categoryId}/notifications`, {
      method: 'POST',
      headers: { 'Api-Username': username },
      body: JSON.stringify({ notification_level: level }),
    })
  }

  /** List all available tags. GET /tags.json */
  async getAllTags(): Promise<DiscourseTagBasic[]> {
    const result = await this.request<{ tags: DiscourseTagBasic[] }>('/tags.json')
    return result?.tags ?? []
  }

  /**
   * Get the user's watched tags via their profile. Returns tags at watching level (3).
   * /tag-notifications.json is unreliable; profile endpoint is authoritative.
   */
  async getTagNotifications(username: string): Promise<DiscourseTagNotification[]> {
    const result = await this.request<{ user: { watched_tags?: Array<{ name: string }> } }>(
      `/u/${encodeURIComponent(username)}.json`
    )
    return (result?.user?.watched_tags ?? []).map((t) => ({
      tag_name: t.name,
      notification_level: 3 as const,
    }))
  }

  /**
   * Set notification level for a tag via PUT /u/{username}.
   * Discourse manages tags as lists (watched_tags, tracked_tags, muted_tags) not numeric levels.
   * Level 3 = watching, level 1 = regular (remove from all lists).
   */
  async setTagNotificationLevel(
    username: string,
    tagName: string,
    level: 0 | 1 | 3
  ): Promise<void> {
    const userData = await this.request<{ user: { watched_tags?: Array<{ name: string }> } }>(
      `/u/${encodeURIComponent(username)}.json`
    )
    const current = (userData?.user?.watched_tags ?? []).map((t) => t.name)
    const without = current.filter((t) => t !== tagName)
    const newList = level === 3 ? [...without, tagName] : without
    await this.request(`/u/${encodeURIComponent(username)}`, {
      method: 'PUT',
      headers: { 'Api-Username': username },
      body: JSON.stringify({ watched_tags: newList.join(',') }),
    })
  }

  /**
   * List groups the user is a member of, with per-user notification levels.
   * Uses user profile instead of /groups.json (which returns all visible groups,
   * including groups the user cannot set notification levels for).
   */
  async getGroupsWithNotifications(username: string): Promise<DiscourseGroupBasic[]> {
    const result = await this.request<{
      user: {
        groups?: DiscourseGroupBasic[]
        group_users?: Array<{ group_id: number; notification_level: number }>
      }
    }>(`/u/${encodeURIComponent(username)}.json`)
    const groups = (result?.user?.groups ?? []).filter((g) => !g.automatic)
    const groupUsers = result?.user?.group_users ?? []
    const notifByGroupId = Object.fromEntries(groupUsers.map((gu) => [gu.group_id, gu.notification_level as 0 | 1 | 2 | 3 | 4]))
    return groups.map((g) => ({ ...g, notification_level: (notifByGroupId[g.id] ?? 3) as 0 | 1 | 2 | 3 | 4 }))
  }

  /**
   * Set notification level for a group for the given user.
   * POST /groups/{name}/notifications.json — Discourse routes by name, not numeric id.
   */
  async setGroupNotificationLevel(
    username: string,
    groupName: string,
    level: 0 | 1 | 3
  ): Promise<void> {
    await this.request(`/groups/${encodeURIComponent(groupName)}/notifications.json`, {
      method: 'POST',
      headers: { 'Api-Username': username },
      body: JSON.stringify({ notification_level: level }),
    })
  }
}
