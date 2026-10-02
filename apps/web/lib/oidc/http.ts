import { IncomingMessage, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import { Duplex } from 'node:stream'
import { OIDC_ISSUER } from './config'

/**
 * oidc-provider registers routes at /jwks and /.well-known/openid-configuration.
 * When the issuer is https://host/oidc it expects the app server to strip that
 * prefix (as Express does with app.use('/oidc', provider.callback())).
 * The Next.js route receives the full path, so strip it here.
 */
export function oidcProviderRequestTarget(requestUrl: string, issuer = OIDC_ISSUER): string {
  const url = new URL(requestUrl)
  const mount = new URL(issuer).pathname.replace(/\/$/, '')
  let path = url.pathname
  if (mount && mount !== '/' && (path === mount || path.startsWith(`${mount}/`))) {
    path = path.slice(mount.length) || '/'
  }
  return `${path}${url.search}`
}

const HOP_BY_HOP = /^(connection|keep-alive|transfer-encoding|content-length)$/i

function decodeChunkedBody(body: Buffer): Buffer {
  const out: Buffer[] = []
  let offset = 0
  while (offset < body.length) {
    const lineEnd = body.indexOf('\r\n', offset)
    if (lineEnd < 0) break
    const size = Number.parseInt(body.subarray(offset, lineEnd).toString('latin1'), 16)
    if (!Number.isFinite(size)) break
    offset = lineEnd + 2
    if (size === 0) break
    out.push(body.subarray(offset, offset + size))
    offset += size + 2
  }
  return Buffer.concat(out)
}

/**
 * assignSocket flushes headers onto the wire and then clears them, so
 * res.getHeaders() is empty by the time 'finish' fires. The status line and
 * headers are still in the bytes written to the socket.
 */
export function parseNodeHttpMessage(raw: Buffer): {
  status: number
  statusText: string
  headers: Headers
  body: Buffer
} {
  const sep = raw.indexOf('\r\n\r\n')
  const head = (sep >= 0 ? raw.subarray(0, sep) : raw).toString('latin1')
  let body = sep >= 0 ? raw.subarray(sep + 4) : Buffer.alloc(0)
  if (/^transfer-encoding:\s*chunked/im.test(head)) {
    body = decodeChunkedBody(body)
  }
  const lines = head.split('\r\n')
  const match = /^HTTP\/\d(?:\.\d)? (\d+)(?: (.*))?$/.exec(lines[0] ?? '')
  const headers = new Headers()
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':')
    if (idx < 1) continue
    const name = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!name || HOP_BY_HOP.test(name)) continue
    headers.append(name, value)
  }
  return {
    status: match ? Number(match[1]) : 200,
    statusText: match?.[2] ?? '',
    headers,
    body,
  }
}

/**
 * Run a Node (req, res) handler against a Fetch Request and return a Response.
 * Used to mount oidc-provider's callback() on App Router routes.
 */
export async function dispatchToNodeHandler(
  request: Request,
  handle: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
): Promise<Response> {
  const url = new URL(request.url)
  const body = Buffer.from(await request.arrayBuffer())

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    // oidc-provider reads POST bodies with req.iterator(), and that destroys
    // the request socket when the body ends. The response must be written to
    // a different socket, otherwise token and userinfo responses are dropped
    // and the caller sees an empty 404.
    const requestSocket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback()
      },
    }) as Duplex & { encrypted?: boolean }
    const responseSocket = new Duplex({
      read() {},
      write(chunk, encoding, callback) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        const done = typeof encoding === 'function' ? encoding : callback
        if (typeof done === 'function') done()
      },
    }) as Duplex & { encrypted?: boolean }

    if (url.protocol === 'https:') {
      requestSocket.encrypted = true
    }

    const req = new IncomingMessage(requestSocket as unknown as Socket)
    req.method = request.method
    // Full path is kept on originalUrl so oidc-provider can recover the /oidc
    // mount prefix when it builds jwks and authorization URLs. req.url is the
    // path the router matches, which does not include that prefix.
    ;(req as IncomingMessage & { originalUrl?: string }).originalUrl =
      `${url.pathname}${url.search}`
    req.url = oidcProviderRequestTarget(request.url)
    req.headers = {}
    request.headers.forEach((value, key) => {
      const existing = req.headers[key]
      if (existing) {
        req.headers[key] = Array.isArray(existing)
          ? [...existing, value]
          : [String(existing), value]
      } else {
        req.headers[key] = value
      }
    })
    req.headers.host ??= url.host
    req.httpVersion = '1.1'
    req.httpVersionMajor = 1
    req.httpVersionMinor = 1

    if (body.length > 0) {
      req.push(body)
    }
    req.push(null)

    const res = new ServerResponse(req)
    res.assignSocket(responseSocket as unknown as Socket)

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      const parsed = parseNodeHttpMessage(Buffer.concat(chunks))
      resolve(
        new Response(new Uint8Array(parsed.body), {
          status: parsed.status || res.statusCode || 200,
          statusText: parsed.statusText || res.statusMessage,
          headers: parsed.headers,
        })
      )
    }

    res.once('finish', finish)
    res.once('error', reject)
    responseSocket.once('error', reject)

    Promise.resolve(handle(req, res)).catch(reject)
  })
}
