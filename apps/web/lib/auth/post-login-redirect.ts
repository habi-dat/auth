function isSafeRelativePath(value: string): boolean {
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !value.includes('://')
  )
}

function parseHttpUrl(value: string, base?: string): URL | null {
  try {
    const url = base ? new URL(value, base) : new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

function isOidcInteractionPath(pathname: string): boolean {
  return pathname === '/oidc-interaction' || pathname.startsWith('/oidc-interaction/')
}

/** Same-origin relative path, or absolute URL on this page's origin. */
export function isAllowedReturnTo(value: string, currentOrigin?: string): boolean {
  if (!value) return false
  if (isSafeRelativePath(value)) return true
  const origin =
    currentOrigin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
  if (!origin) return false
  const url = parseHttpUrl(value)
  return url != null && url.origin === origin
}

/** OIDC interaction return: same origin and `/oidc-interaction`. */
export function isAllowedCallbackUrl(value: string, currentOrigin?: string): boolean {
  if (!value) return false
  const origin =
    currentOrigin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
  const url = parseHttpUrl(value, origin)
  if (!url || !isOidcInteractionPath(url.pathname)) return false
  if (!origin) return isSafeRelativePath(value) || url.pathname.startsWith('/')
  return url.origin === origin
}

export function resolvePostLoginHref(
  returnTo: string | null,
  callbackUrl: string | null,
  currentOrigin?: string
): string {
  if (callbackUrl && isAllowedCallbackUrl(callbackUrl, currentOrigin)) return callbackUrl
  if (returnTo && isAllowedReturnTo(returnTo, currentOrigin)) return returnTo
  return '/'
}
