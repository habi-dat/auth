import { createHmac } from 'node:crypto'
import type {
  CreateCategoryData,
  CreateGroupData,
  DiscourseCategoryApi,
  DiscourseConfig,
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
   * Sync user via SSO. Use externalId = user.discourseId ?? user.username;
   * save discourseId after first sync so it persists when username changes.
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
      console.log(`Unsuspending Discourse user (id: ${userId})`)
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
}
