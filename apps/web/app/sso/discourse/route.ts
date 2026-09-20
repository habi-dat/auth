import { getUserGroupSlugs } from '@habidat/auth/group-slugs'
import { getCurrentUserWithGroups, getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import {
  applySsoAvatarFields,
  avatarUrlForDiscourse,
  hmacSha256Hex,
  parseAllowedDiscourseReturnUrl,
  resolveDiscourseExternalId,
  verifyDiscourseSsoPayload,
} from '@habidat/discourse'
import { webEnv } from '@habidat/env/web'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { DISCOURSE_SSO_SECRET, DISCOURSE_URL, APP_URL, DISCOURSE_AVATAR_BASE_URL, TRUSTED_ORIGINS } =
    webEnv
  if (!DISCOURSE_SSO_SECRET) {
    return NextResponse.json({ error: 'Discourse SSO not configured' }, { status: 503 })
  }

  const url = new URL(request.url)
  const appUrl = APP_URL
  const ssoParam = url.searchParams.get('sso')
  const sig = url.searchParams.get('sig')

  if (!ssoParam || !sig) {
    return NextResponse.json({ error: 'Missing sso or sig' }, { status: 400 })
  }

  const sso = verifyDiscourseSsoPayload(DISCOURSE_SSO_SECRET, ssoParam, sig)
  if (!sso) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const decoded = Buffer.from(sso, 'base64').toString('utf8')
  const params = new URLSearchParams(decoded)
  const nonce = params.get('nonce')
  const returnSsoUrl = params.get('return_sso_url')

  if (!nonce || !returnSsoUrl) {
    return NextResponse.json({ error: 'Invalid SSO payload' }, { status: 400 })
  }

  const redirectUrl = parseAllowedDiscourseReturnUrl(returnSsoUrl, {
    discourseUrl: DISCOURSE_URL,
    appUrl,
    trustedOrigins: TRUSTED_ORIGINS,
  })
  if (!redirectUrl) {
    return NextResponse.json({ error: 'Invalid return URL' }, { status: 400 })
  }

  const session = await getSession()
  if (!session?.user) {
    const loginUrl = new URL(`${appUrl}/login`)
    loginUrl.searchParams.set('returnTo', url.pathname + url.search)
    return NextResponse.redirect(loginUrl)
  }

  const sessionWithGroups = await getCurrentUserWithGroups()
  if (!sessionWithGroups) {
    const loginUrl = new URL(`${appUrl}/login`)
    loginUrl.searchParams.set('returnTo', url.pathname + url.search)
    return NextResponse.redirect(loginUrl)
  }

  const user = sessionWithGroups.user
  const externalId = resolveDiscourseExternalId(user)
  if (!user.discourseId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { discourseId: externalId },
    })
  }

  const memberGroupIds = sessionWithGroups.memberships.map(
    (m: { group: { id: string } }) => m.group.id
  )
  const groups = await getUserGroupSlugs(prisma, memberGroupIds)

  const responseParams = new URLSearchParams({
    nonce,
    external_id: externalId,
    email: user.email ?? '',
    username: user.username ?? user.name ?? '',
    name: user.name ?? '',
    require_activation: 'false',
    groups: groups.join(','),
  })
  if (user.image) {
    applySsoAvatarFields(responseParams, {
      avatarUrl: avatarUrlForDiscourse(user.image, {
        appUrl,
        fetchBaseUrl: DISCOURSE_AVATAR_BASE_URL,
      }),
    })
  }

  const payload = Buffer.from(responseParams.toString()).toString('base64')
  const responseSig = hmacSha256Hex(DISCOURSE_SSO_SECRET, payload)

  redirectUrl.searchParams.set('sso', payload)
  redirectUrl.searchParams.set('sig', responseSig)

  return NextResponse.redirect(redirectUrl)
}
