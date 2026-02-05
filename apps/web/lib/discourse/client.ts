import { DiscourseService } from '@habidat/discourse'
import { webEnv } from '@habidat/env/web'

let discourseClient: DiscourseService | null = null

/**
 * Get Discourse API client when Discourse is configured (URL, API key, username).
 * Returns null if any required env var is missing.
 */
export function getDiscourseClient(): DiscourseService | null {
  const { DISCOURSE_URL, DISCOURSE_API_KEY, DISCOURSE_API_USERNAME, DISCOURSE_SSO_SECRET } = webEnv
  if (!DISCOURSE_URL || !DISCOURSE_API_KEY || !DISCOURSE_API_USERNAME) {
    return null
  }
  if (!discourseClient) {
    discourseClient = new DiscourseService({
      url: DISCOURSE_URL,
      apiKey: DISCOURSE_API_KEY,
      apiUsername: DISCOURSE_API_USERNAME,
      ssoSecret: DISCOURSE_SSO_SECRET ?? '',
    })
  }
  return discourseClient
}

/** Check if Discourse is configured for category management. */
export function isDiscourseConfigured(): boolean {
  return getDiscourseClient() != null
}
