import { NextResponse } from 'next/server'
import { findSamlAppBySlug, handleSamlLogin, readSamlBindingParams } from '@/lib/sso/saml-login'

async function handle(request: Request, appSlug: string) {
  const app = await findSamlAppBySlug(appSlug)
  if (!app?.samlEnabled) {
    return NextResponse.json({ error: 'App not found' }, { status: 404 })
  }
  const { samlRequest, relayState, binding } = await readSamlBindingParams(request)
  return handleSamlLogin({ request, app, samlRequest, relayState, binding })
}

export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params
  return handle(request, appSlug)
}

export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params
  return handle(request, appSlug)
}
