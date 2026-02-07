import { auth } from '@habidat/auth'
import { getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import {
  createLogoutRequestRedirect,
  createLogoutResponseRedirect,
  createMinimalParsedRequest,
  decodeLogoutState,
  encodeLogoutState,
  type ParsedLogoutRequest,
  parseLogoutRequest,
} from '@habidat/saml'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params
  const searchParams = new URL(request.url).searchParams
  const samlRequest = searchParams.get('SAMLRequest')
  const samlResponse = searchParams.get('SAMLResponse')
  const relayState = searchParams.get('RelayState')

  if (samlRequest) {
    return handleLogoutRequest(request, appSlug, samlRequest, relayState)
  }
  if (samlResponse) {
    return handleLogoutResponse(request, appSlug, samlResponse, relayState)
  }

  // IdP-initiated logout (or placeholder slug like "init")
  return initiateLogoutFlow(request)
}

async function handleLogoutRequest(
  request: Request,
  appSlug: string,
  samlRequest: string,
  relayState: string | null
) {
  const app = await prisma.app.findUnique({
    where: { slug: appSlug },
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

  const sessionData = await getSession()
  if (!sessionData?.session) {
    // Already signed out locally, just respond to SP
    const redirectUrl = createLogoutResponseRedirect(app, requestInfo, relayState)
    return NextResponse.redirect(redirectUrl)
  }

  const session = sessionData.session as { id: string }
  // Find OTHER apps to logout
  const otherSamlApps = await prisma.samlSessionApp.findMany({
    where: { sessionId: session.id, NOT: { appId: app.id } },
    include: { app: true },
  })

  const chainState = encodeLogoutState({
    remainingAppIds: otherSamlApps.map((a) => a.appId),
    initiatorAppId: app.id,
    initiatorRelayState: relayState ?? undefined,
    initiatorRequestId: requestInfo.extract.request?.id,
  })

  // Start the chain or finalize if no other apps
  return processNextInChain(request, chainState)
}

async function handleLogoutResponse(
  request: Request,
  _appSlug: string,
  _samlResponse: string,
  relayState: string | null
) {
  const state = decodeLogoutState(relayState)
  if (!state) {
    // No state, assume it was a single app logout or legacy flow
    await auth.api.signOut({ headers: await headers() }).catch(() => {})
    return NextResponse.redirect(new URL(`${appUrl}/login`, request.url))
  }

  // Continue the chain
  return processNextInChain(request, relayState!)
}

async function initiateLogoutFlow(request: Request) {
  const sessionData = await getSession()
  if (!sessionData?.session) {
    return NextResponse.redirect(new URL(`${appUrl}/login`, request.url))
  }
  const session = sessionData.session as { id: string }
  const samlApps = await prisma.samlSessionApp.findMany({
    where: { sessionId: session.id },
    include: { app: true },
  })

  if (samlApps.length === 0) {
    await auth.api.signOut({ headers: await headers() }).catch(() => {})
    return NextResponse.redirect(new URL(`${appUrl}/login`, request.url))
  }

  const chainState = encodeLogoutState({
    remainingAppIds: samlApps.map((a) => a.appId),
  })

  return processNextInChain(request, chainState)
}

/**
 * Common logic to take the next app from the chain state and redirect to its SLO endpoint,
 * or finalize the logout flow if no apps remain.
 */
async function processNextInChain(request: Request, currentState: string) {
  const state = decodeLogoutState(currentState)
  if (!state || state.remainingAppIds.length === 0) {
    // Chain finished.
    if (state?.initiatorAppId && state.initiatorRequestId) {
      // Respond back to the SP that started it all
      const initiatorApp = await prisma.app.findUnique({
        where: { id: state.initiatorAppId },
      })
      if (initiatorApp) {
        const minimalRequest = createMinimalParsedRequest(state.initiatorRequestId)
        const redirectUrl = createLogoutResponseRedirect(
          initiatorApp,
          minimalRequest,
          state.initiatorRelayState
        )
        // Sign out locally before returning to SP
        await auth.api.signOut({ headers: await headers() }).catch(() => {})
        return NextResponse.redirect(redirectUrl)
      }
    }

    // Default: local signout and redirect to login
    await auth.api.signOut({ headers: await headers() }).catch(() => {})
    return NextResponse.redirect(new URL(`${appUrl}/login`, request.url))
  }

  const nextAppId = state.remainingAppIds[0]
  const nextApp = await prisma.app.findUnique({
    where: { id: nextAppId },
  })
  const sessionData = await getSession()
  const session = sessionData?.session as { id: string } | undefined
  const samlSession = await prisma.samlSessionApp.findFirst({
    where: { sessionId: session?.id, appId: nextAppId },
  })

  if (!nextApp?.samlSloUrl || !samlSession) {
    // Skip this app and continue
    const nextState = encodeLogoutState({
      ...state,
      remainingAppIds: state.remainingAppIds.slice(1),
    })
    return processNextInChain(request, nextState)
  }

  const nextState = encodeLogoutState({
    ...state,
    remainingAppIds: state.remainingAppIds.slice(1),
  })

  const redirectUrl = createLogoutRequestRedirect({
    app: nextApp,
    nameId: samlSession.nameId,
    relayState: nextState,
  })

  return NextResponse.redirect(redirectUrl)
}
