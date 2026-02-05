import { auth } from '@/lib/auth'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@habidat/db'
import {
  createLogoutRequestRedirect,
  createLogoutResponseRedirect,
  parseLogoutRequest,
  type ParsedLogoutRequest,
} from '@/lib/saml/logout'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params
  const searchParams = new URL(request.url).searchParams
  const samlRequest = searchParams.get('SAMLRequest')
  const samlResponse = searchParams.get('SAMLResponse')

  if (samlRequest) {
    return handleLogoutRequest(request, appSlug, samlRequest, searchParams.get('RelayState'))
  }
  if (samlResponse) {
    return handleLogoutResponse(request, appSlug, samlResponse)
  }

  return initiateLogoutFlow(request)
}

async function handleLogoutRequest(
  _request: Request,
  appSlug: string,
  samlRequest: string,
  relayState: string | null
) {
  const app = await prisma.app.findUnique({
    where: { slug: appSlug },
    include: { groupAccess: true },
  })
  if (!app?.samlEnabled) {
    return NextResponse.json({ error: 'App not found' }, { status: 404 })
  }
  let requestInfo: ParsedLogoutRequest
  try {
    requestInfo = await parseLogoutRequest(app, {
      query: { SAMLRequest: samlRequest, RelayState: relayState ?? undefined },
    })
  } catch {
    return NextResponse.json({ error: 'Invalid SAML logout request' }, { status: 400 })
  }
  const redirectUrl = createLogoutResponseRedirect(app, requestInfo, relayState)
  return NextResponse.redirect(redirectUrl)
}

async function handleLogoutResponse(request: Request, _appSlug: string, _samlResponse: string) {
  await auth.api.signOut({ headers: await request.headers }).catch(() => {})
  return NextResponse.redirect(new URL('/login', request.url))
}

async function initiateLogoutFlow(request: Request) {
  const sessionData = await getSession()
  if (!sessionData?.session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  const session = sessionData.session as { id: string }
  const samlApps = await prisma.samlSessionApp.findMany({
    where: { sessionId: session.id },
    include: { app: true },
  })
  if (samlApps.length === 0) {
    await auth.api.signOut({ headers: await request.headers }).catch(() => {})
    return NextResponse.redirect(new URL('/login', request.url))
  }
  const first = samlApps[0]
  const sloUrl = first.app.samlSloUrl ?? ''
  if (!sloUrl) {
    await auth.api.signOut({ headers: await request.headers }).catch(() => {})
    return NextResponse.redirect(new URL('/login', request.url))
  }
  const redirectUrl = createLogoutRequestRedirect({
    app: first.app,
    nameId: first.nameId,
  })
  return NextResponse.redirect(redirectUrl)
}
