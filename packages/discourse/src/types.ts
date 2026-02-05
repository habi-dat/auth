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
