import { canAccessApp } from '@/lib/auth/roles'
import { getSession } from '@/lib/auth/session'
import { getCurrentUserWithGroups } from '@/lib/auth/session'
import { prisma } from '@habidat/db'
import {
  createLoginResponse,
  generateSamlPostForm,
  parseLoginRequest,
  type ParsedLoginRequest,
} from '@/lib/saml/response'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
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
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('samlApp', appSlug)
    if (samlRequest) loginUrl.searchParams.set('SAMLRequest', samlRequest)
    if (relayState) loginUrl.searchParams.set('RelayState', relayState)
    return NextResponse.redirect(loginUrl)
  }

  const sessionWithGroups = await getCurrentUserWithGroups()
  if (!sessionWithGroups) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('samlApp', appSlug)
    if (samlRequest) loginUrl.searchParams.set('SAMLRequest', samlRequest)
    if (relayState) loginUrl.searchParams.set('RelayState', relayState)
    return NextResponse.redirect(loginUrl)
  }

  if (!canAccessApp(sessionWithGroups, app)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (!samlRequest) {
    return NextResponse.json({ error: 'Missing SAMLRequest' }, { status: 400 })
  }

  let requestInfo: ParsedLoginRequest
  try {
    requestInfo = await parseLoginRequest(app, {
      query: { SAMLRequest: samlRequest, RelayState: relayState ?? undefined },
    })
  } catch {
    return NextResponse.json({ error: 'Invalid SAML request' }, { status: 400 })
  }

  const acsUrl = app.samlAcsUrl ?? ''
  if (!acsUrl) {
    return NextResponse.json({ error: 'App ACS URL not configured' }, { status: 400 })
  }

  const user = {
    id: sessionWithGroups.user.id,
    email: sessionWithGroups.user.email,
    name: sessionWithGroups.user.name,
  }
  const result = await createLoginResponse(app, requestInfo, user, relayState)

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
