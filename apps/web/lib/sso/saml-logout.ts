import { getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import { parseAllowedLogoutReturnUrl } from '@habidat/discourse'
import { webEnv } from '@habidat/env/web'
import {
  createLogoutRequestRedirect,
  createLogoutResponseRedirect,
  createMinimalParsedRequest,
  decodeLogoutState,
  encodeLogoutState,
  type ParsedLogoutRequest,
  parseLogoutRequest,
  samlExtractRequestId,
} from '@habidat/saml'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { logoutCurrentUserFromDiscourse } from '@/lib/discourse/logout'
import {
  findSamlAppBySlug,
  readSamlBindingParams,
  resolveSamlAppFromRequest,
} from '@/lib/sso/saml-login'

const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function logoutReturnAllowlist() {
  return {
    discourseUrl: webEnv.DISCOURSE_URL,
    appUrl: webEnv.APP_URL ?? appUrl,
    trustedOrigins: webEnv.TRUSTED_ORIGINS,
  }
}

function resolveReturnTo(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  return parseAllowedLogoutReturnUrl(raw, logoutReturnAllowlist())?.toString()
}

function finishLocalLogoutRedirect(request: Request, returnTo?: string) {
  if (returnTo) return NextResponse.redirect(returnTo)
  return NextResponse.redirect(new URL(`${appUrl}/login`, request.url))
}

export async function handleSamlLogout(request: Request, appSlug?: string) {
  const { samlRequest, samlResponse, relayState, binding } = await readSamlBindingParams(request)

  if (samlRequest) {
    return handleLogoutRequest(request, samlRequest, relayState, binding, appSlug)
  }
  if (samlResponse) {
    return handleLogoutResponse(request, relayState)
  }

  return initiateLogoutFlow(request)
}

async function handleLogoutRequest(
  request: Request,
  samlRequest: string,
  relayState: string | null,
  binding: 'redirect' | 'post',
  appSlug?: string
) {
  const app = appSlug
    ? await findSamlAppBySlug(appSlug)
    : await resolveSamlAppFromRequest(samlRequest, binding)
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
    const redirectUrl = createLogoutResponseRedirect(app, requestInfo, relayState)
    return NextResponse.redirect(redirectUrl)
  }

  await logoutCurrentUserFromDiscourse()

  const session = sessionData.session as { id: string }
  const otherSamlApps = await prisma.samlSessionApp.findMany({
    where: { sessionId: session.id, NOT: { appId: app.id } },
    include: { app: true },
  })

  const chainState = encodeLogoutState({
    remainingAppIds: otherSamlApps.map((a) => a.appId),
    initiatorAppId: app.id,
    initiatorRelayState: relayState ?? undefined,
    initiatorRequestId: samlExtractRequestId(requestInfo.extract),
  })

  return processNextInChain(request, chainState)
}

async function handleLogoutResponse(request: Request, relayState: string | null) {
  const state = decodeLogoutState(relayState)
  if (!state) {
    await auth.api.signOut({ headers: await headers() }).catch(() => {})
    return NextResponse.redirect(new URL(`${appUrl}/login`, request.url))
  }

  return processNextInChain(request, relayState!)
}

async function initiateLogoutFlow(request: Request) {
  const returnTo = resolveReturnTo(new URL(request.url).searchParams.get('returnTo'))
  const sessionData = await getSession()
  if (!sessionData?.session) {
    return finishLocalLogoutRedirect(request, returnTo)
  }

  await logoutCurrentUserFromDiscourse()

  const session = sessionData.session as { id: string }
  const samlApps = await prisma.samlSessionApp.findMany({
    where: { sessionId: session.id },
    include: { app: true },
  })

  if (samlApps.length === 0) {
    await auth.api.signOut({ headers: await headers() }).catch(() => {})
    return finishLocalLogoutRedirect(request, returnTo)
  }

  const chainState = encodeLogoutState({
    remainingAppIds: samlApps.map((a) => a.appId),
    returnTo,
  })

  return processNextInChain(request, chainState)
}

async function processNextInChain(request: Request, currentState: string) {
  const state = decodeLogoutState(currentState)
  if (!state || state.remainingAppIds.length === 0) {
    if (state?.initiatorAppId && state.initiatorRequestId) {
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
        await auth.api.signOut({ headers: await headers() }).catch(() => {})
        return NextResponse.redirect(redirectUrl)
      }
    }

    await auth.api.signOut({ headers: await headers() }).catch(() => {})
    return finishLocalLogoutRedirect(request, resolveReturnTo(state?.returnTo))
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
