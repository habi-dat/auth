import { getAncestorGroupIds, getUserGroupSlugs } from '@habidat/auth/group-slugs'
import { canAccessApp } from '@habidat/auth/roles'
import { getCurrentUserWithGroups, getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import {
  createLoginResponse,
  extractSamlIssuer,
  generateSamlPostForm,
  type ParsedLoginRequest,
  parseLoginRequest,
} from '@habidat/saml'
import { NextResponse } from 'next/server'

type SamlBinding = 'redirect' | 'post'

type AppWithAccess = NonNullable<Awaited<ReturnType<typeof findSamlAppByIssuer>>>

export async function findSamlAppByIssuer(issuer: string) {
  const trimmed = issuer.trim()
  const withoutSlash = trimmed.replace(/\/$/, '')
  const candidates = [...new Set([trimmed, withoutSlash, `${withoutSlash}/`])]
  return prisma.app.findFirst({
    where: { samlEnabled: true, samlEntityId: { in: candidates } },
    include: { groupAccess: true },
  })
}

export async function findSamlAppBySlug(slug: string) {
  return prisma.app.findUnique({
    where: { slug },
    include: { groupAccess: true },
  })
}

export async function readSamlBindingParams(request: Request): Promise<{
  samlRequest: string | null
  samlResponse: string | null
  relayState: string | null
  binding: SamlBinding
}> {
  if (request.method === 'POST') {
    const form = await request.formData()
    const asString = (value: FormDataEntryValue | null) =>
      typeof value === 'string' && value.length > 0 ? value : null
    return {
      samlRequest: asString(form.get('SAMLRequest')),
      samlResponse: asString(form.get('SAMLResponse')),
      relayState: asString(form.get('RelayState')),
      binding: 'post',
    }
  }
  const searchParams = new URL(request.url).searchParams
  return {
    samlRequest: searchParams.get('SAMLRequest'),
    samlResponse: searchParams.get('SAMLResponse'),
    relayState: searchParams.get('RelayState'),
    binding: 'redirect',
  }
}

export async function resolveSamlAppFromRequest(
  samlRequest: string,
  binding: SamlBinding
): Promise<AppWithAccess | null> {
  const issuer = extractSamlIssuer(samlRequest, binding)
  if (!issuer) return null
  return findSamlAppByIssuer(issuer)
}

export async function handleSamlLogin(params: {
  request: Request
  app: AppWithAccess
  samlRequest: string | null
  relayState: string | null
  binding: SamlBinding
}): Promise<NextResponse> {
  const { request, app, samlRequest, relayState, binding } = params
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!app.samlEnabled) {
    return NextResponse.json({ error: 'App not found' }, { status: 404 })
  }

  const sessionData = await getSession()
  if (!sessionData?.user) {
    return redirectToLogin(appUrl, request, app.slug, samlRequest, relayState)
  }

  const sessionWithGroups = await getCurrentUserWithGroups()
  if (!sessionWithGroups) {
    return redirectToLogin(appUrl, request, app.slug, samlRequest, relayState)
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
    requestInfo = await parseLoginRequest(
      app,
      binding === 'post'
        ? { body: { SAMLRequest: samlRequest, RelayState: relayState ?? '' } }
        : {
            query: {
              SAMLRequest: encodeURIComponent(samlRequest),
              RelayState: relayState ?? '',
            },
          },
      binding
    )
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

  let result: { entityEndpoint: string; context: string; relayState?: string | null }
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
      update: { nameId: sessionWithGroups.user.username },
      create: {
        sessionId: session.id,
        appId: app.id,
        nameId: sessionWithGroups.user.username,
      },
    })
  }

  return new NextResponse(
    generateSamlPostForm(result.entityEndpoint, result.context, result.relayState ?? null),
    { headers: { 'Content-Type': 'text/html' } }
  )
}

function redirectToLogin(
  appUrl: string,
  request: Request,
  appSlug: string,
  samlRequest: string | null,
  relayState: string | null
) {
  const loginUrl = new URL(`${appUrl}/login`, request.url)
  loginUrl.searchParams.set('samlApp', appSlug)
  if (samlRequest) loginUrl.searchParams.set('SAMLRequest', samlRequest)
  if (relayState) loginUrl.searchParams.set('RelayState', relayState)
  return NextResponse.redirect(loginUrl)
}
