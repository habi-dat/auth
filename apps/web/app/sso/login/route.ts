import { NextResponse } from 'next/server'
import {
  handleSamlLogin,
  readSamlBindingParams,
  resolveSamlAppFromRequest,
} from '@/lib/sso/saml-login'

async function handle(request: Request) {
  const { samlRequest, relayState, binding } = await readSamlBindingParams(request)
  if (!samlRequest) {
    return NextResponse.json({ error: 'Missing SAMLRequest' }, { status: 400 })
  }
  const app = await resolveSamlAppFromRequest(samlRequest, binding)
  if (!app?.samlEnabled) {
    return NextResponse.json({ error: 'App not found' }, { status: 404 })
  }
  return handleSamlLogin({ request, app, samlRequest, relayState, binding })
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
