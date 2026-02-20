import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { type NextRequest, NextResponse } from 'next/server'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path
  const relative = segments.join('/')

  if (relative.includes('..')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const filepath = path.join(process.cwd(), 'public', 'uploads', relative)

  try {
    const fileStat = await stat(filepath)
    if (!fileStat.isFile()) {
      return new NextResponse('Not found', { status: 404 })
    }

    const buffer = await readFile(filepath)
    const ext = path.extname(filepath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, immutable',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
