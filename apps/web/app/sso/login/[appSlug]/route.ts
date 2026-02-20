import { getAncestorGroupIds, getUserGroupSlugs } from '@habidat/auth/group-slugs'
import { canAccessApp } from '@habidat/auth/roles'
import { getCurrentUserWithGroups, getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import {
  createLoginResponse,
  generateSamlPostForm,
  type ParsedLoginRequest,
  parseLoginRequest,
} from '@habidat/saml'
import { NextResponse } from 'next/server'

export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { appSlug } = await context.params
  const searchParams = new URL(request.url).searchParams
  const samlRequest = searchParams.get('SAMLRequest')
  const relayState = searchParams.get('RelayState')

  const app = await prisma.app.findUnique({
    where: { slug: appSlug },
    include: { groupAccess: true },
  })

  if (!app?.samlEnabled) {
    return NextResponse.json({ error: 'App not found' }, { status: 404 })
  }

  const sessionData = await getSession()
  if (!sessionData?.user) {
    const loginUrl = new URL(`${appUrl}/login`, request.url)
    loginUrl.searchParams.set('samlApp', appSlug)
    if (samlRequest) loginUrl.searchParams.set('SAMLRequest', samlRequest)
    if (relayState) loginUrl.searchParams.set('RelayState', relayState)
    return NextResponse.redirect(loginUrl)
  }

  const sessionWithGroups = await getCurrentUserWithGroups()
  if (!sessionWithGroups) {
    const loginUrl = new URL(`${appUrl}/login`, request.url)
    loginUrl.searchParams.set('samlApp', appSlug)
    if (samlRequest) loginUrl.searchParams.set('SAMLRequest', samlRequest)
    if (relayState) loginUrl.searchParams.set('RelayState', relayState)
    return NextResponse.redirect(loginUrl)
  }

  const memberGroupIds = sessionWithGroups.memberships.map(
    (m: { group: { id: string } }) => m.group.id
  )
  const ancestorGroupIds = await getAncestorGroupIds(prisma, memberGroupIds)

  if (!canAccessApp(sessionWithGroups, app, ancestorGroupIds)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (!samlRequest) {
    return NextResponse.json({ error: 'Missing SAMLRequest' }, { status: 400 })
  }

  let requestInfo: ParsedLoginRequest
  try {
    requestInfo = await parseLoginRequest(app, {
      query: {
        SAMLRequest: encodeURIComponent(samlRequest),
        RelayState: relayState ?? '',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Invalid SAML request' }, { status: 400 })
  }

  const acsUrl = app.samlAcsUrl ?? ''
  if (!acsUrl) {
    return NextResponse.json({ error: 'App ACS URL not configured' }, { status: 400 })
  }

  const groups = await getUserGroupSlugs(prisma, memberGroupIds)
  const user = {
    id: sessionWithGroups.user.id,
    email: sessionWithGroups.user.email,
    username: sessionWithGroups.user.name,
    uid: sessionWithGroups.user.username,
    location: sessionWithGroups.user.location ?? null,
    title: sessionWithGroups.primaryGroup?.name ?? null,
    groups,
  }

  // biome-ignore lint/suspicious/noExplicitAny: is any
  let result: any
  try {
    result = await createLoginResponse(app, requestInfo, user, relayState)
  } catch (e) {
    console.error('Failed to create login response:', e)
    return NextResponse.json({ error: 'Failed to create login response' }, { status: 500 })
  }

  const session = sessionData.session as { id: string }
  if (session?.id) {
    await prisma.samlSessionApp.upsert({
      where: {
        sessionId_appId: { sessionId: session.id, appId: app.id },
      },
      update: { nameId: sessionWithGroups.user.email },
      create: {
        sessionId: session.id,
        appId: app.id,
        nameId: sessionWithGroups.user.email,
      },
    })
  }

  return new NextResponse(
    generateSamlPostForm(result.entityEndpoint, result.context, result.relayState ?? null),
    { headers: { 'Content-Type': 'text/html' } }
  )
}
