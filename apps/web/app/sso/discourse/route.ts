import { createHmac } from 'node:crypto'
import { getAncestorGroupIds, getUserGroupSlugs } from '@habidat/auth/group-slugs'
import { getCurrentUserWithGroups, getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import { resolveDiscourseExternalId } from '@habidat/discourse'
import { webEnv } from '@habidat/env/web'
import { NextResponse } from 'next/server'

function hmacSha256(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export async function GET(request: Request) {
  const { DISCOURSE_SSO_SECRET } = webEnv
  if (!DISCOURSE_SSO_SECRET) {
    return NextResponse.json({ error: 'Discourse SSO not configured' }, { status: 503 })
  }

  const url = new URL(request.url)
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? url.origin
  const sso = url.searchParams.get('sso')
  const sig = url.searchParams.get('sig')

  if (!sso || !sig) {
    return NextResponse.json({ error: 'Missing sso or sig' }, { status: 400 })
  }

  // Verify HMAC signature from Discourse
  const expectedSig = hmacSha256(DISCOURSE_SSO_SECRET, sso)
  if (expectedSig !== sig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  // Decode the nonce and return_sso_url from the payload
  const decoded = Buffer.from(sso, 'base64').toString('utf8')
  const params = new URLSearchParams(decoded)
  const nonce = params.get('nonce')
  const returnSsoUrl = params.get('return_sso_url')

  if (!nonce || !returnSsoUrl) {
    return NextResponse.json({ error: 'Invalid SSO payload' }, { status: 400 })
  }

  // Check if user is logged in
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
  const ancestorGroupIds = await getAncestorGroupIds(prisma, memberGroupIds)
  const allGroupIds = [...memberGroupIds, ...ancestorGroupIds]
  const groups = await getUserGroupSlugs(prisma, allGroupIds)

  // Build the response payload
  const responseParams = new URLSearchParams({
    nonce,
    external_id: externalId,
    email: user.email ?? '',
    username: user.username ?? user.name ?? '',
    name: user.name ?? '',
  })
  if (groups.length > 0) {
    responseParams.set('groups', groups.join(','))
  }

  const payload = Buffer.from(responseParams.toString()).toString('base64')
  const responseSig = hmacSha256(DISCOURSE_SSO_SECRET, payload)

  const redirectUrl = new URL(returnSsoUrl)
  redirectUrl.searchParams.set('sso', payload)
  redirectUrl.searchParams.set('sig', responseSig)

  return NextResponse.redirect(redirectUrl)
}
