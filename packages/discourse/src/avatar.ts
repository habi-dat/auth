export function isCustomDiscourseAvatar(info: {
  uploadedAvatarId?: number | null
  avatarTemplate?: string | null
}): boolean {
  if (info.uploadedAvatarId == null) return false
  const template = (info.avatarTemplate ?? '').toLowerCase()
  if (!template) return false
  if (template.includes('letter_avatar')) return false
  if (template.includes('gravatar.com')) return false
  return true
}

export function resolveDiscourseAvatarDownloadUrl(
  discourseUrl: string,
  template: string,
  size = 512
): string {
  const resolved = template.replaceAll('{size}', String(size))
  if (/^https?:\/\//i.test(resolved)) return resolved
  const base = discourseUrl.replace(/\/$/, '')
  return resolved.startsWith('/') ? `${base}${resolved}` : `${base}/${resolved}`
}

export function absoluteAppAssetUrl(appUrl: string, assetPath: string): string {
  const base = appUrl.replace(/\/$/, '')
  const path = assetPath.startsWith('/') ? assetPath : `/${assetPath}`
  return `${base}${path}`
}

/** URL Discourse FileHelper downloads. Prefer an HTTP :80 Docker host; APP_URL is often unreachable from Discourse (*.localhost → loopback, self-signed HTTPS). */
export function avatarUrlForDiscourse(
  assetPath: string,
  opts: { appUrl: string; fetchBaseUrl?: string }
): string {
  return absoluteAppAssetUrl(opts.fetchBaseUrl || opts.appUrl, assetPath)
}

export function applySsoAvatarFields(
  params: URLSearchParams,
  opts: { avatarUrl?: string; avatarForceUpdate?: boolean }
): void {
  if (opts.avatarUrl) params.set('avatar_url', opts.avatarUrl)
  if (opts.avatarForceUpdate) params.set('avatar_force_update', 'true')
}
