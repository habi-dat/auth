import { generateIdpMetadata } from '@habidat/saml'
import { NextResponse } from 'next/server'

export async function GET() {
  const metadata = generateIdpMetadata()
  return new NextResponse(metadata, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
