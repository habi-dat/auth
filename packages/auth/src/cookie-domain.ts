/** Parent cookie domain for sharing the session across habidat app subdomains. */
export function cookieParentDomain(appUrl: string): string | undefined {
  let hostname: string
  try {
    hostname = new URL(appUrl).hostname.toLowerCase()
  } catch {
    return undefined
  }

  if (hostname === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return undefined
  }

  const parts = hostname.split('.').filter(Boolean)
  if (parts.length < 3) return undefined
  return parts.slice(1).join('.')
}
