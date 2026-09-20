import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { getUploadsRoot } from '@habidat/env/uploads'
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

function uploadRoots(): string[] {
  const roots = [path.resolve(getUploadsRoot()), path.resolve(process.cwd(), 'public', 'uploads')]
  return [...new Set(roots)]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const relative = (await params).path.join('/')
  const candidates = uploadRoots()
    .map((root) => {
      const filepath = path.resolve(root, relative)
      if (filepath !== root && !filepath.startsWith(`${root}${path.sep}`)) return null
      return filepath
    })
    .filter((p): p is string => p != null)

  if (candidates.length === 0 || relative.includes('..')) {
    return new NextResponse('Not found', { status: 404 })
  }

  for (const filepath of candidates) {
    try {
      const fileStat = await stat(filepath)
      if (!fileStat.isFile()) continue

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
      // try the next root (avatars vs logos can live in different dirs)
    }
  }

  return new NextResponse('Not found', { status: 404 })
}
