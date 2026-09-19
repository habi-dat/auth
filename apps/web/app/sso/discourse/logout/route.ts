import { parseAllowedLogoutReturnUrl, publicDiscourseOrigin } from '@habidat/discourse'
import { webEnv } from '@habidat/env/web'
import { NextResponse } from 'next/server'

/**
 * Discourse `logout_redirect` target. Signs the user out of habidat (and SAML
 * apps) the same way the header Sign out control does.
 */
export async function GET(request: Request) {
  const { DISCOURSE_SSO_SECRET, DISCOURSE_URL, APP_URL, TRUSTED_ORIGINS } = webEnv
  if (!DISCOURSE_SSO_SECRET) {
    return NextResponse.json({ error: 'Discourse SSO not configured' }, { status: 503 })
  }

  const allowlist = {
    discourseUrl: DISCOURSE_URL,
    appUrl: APP_URL,
    trustedOrigins: TRUSTED_ORIGINS,
  }
  const url = new URL(request.url)
  const appUrl = APP_URL ?? url.origin

  const candidates = [
    url.searchParams.get('returnTo'),
    request.headers.get('referer'),
    publicDiscourseOrigin(DISCOURSE_URL),
  ]
  let returnTo: string | undefined
  for (const candidate of candidates) {
    if (!candidate) continue
    const parsed = parseAllowedLogoutReturnUrl(candidate, allowlist)
    if (parsed) {
      returnTo = parsed.toString()
      break
    }
  }

  const logoutUrl = new URL('/sso/logout/init', appUrl)
  if (returnTo) logoutUrl.searchParams.set('returnTo', returnTo)
  return NextResponse.redirect(logoutUrl)
}
