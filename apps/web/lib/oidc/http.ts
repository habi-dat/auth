import { IncomingMessage, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import { Duplex } from 'node:stream'

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
    const socket = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        callback()
      },
    }) as Duplex & { encrypted?: boolean }

    if (url.protocol === 'https:') {
      socket.encrypted = true
    }

    const nodeSocket = socket as unknown as Socket
    const req = new IncomingMessage(nodeSocket)
    req.method = request.method
    req.url = `${url.pathname}${url.search}`
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
    res.assignSocket(nodeSocket)

    const finish = () => {
      const headers = new Headers()
      for (const [key, value] of Object.entries(res.getHeaders())) {
        if (value === undefined) continue
        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, String(item))
        } else {
          headers.set(key, String(value))
        }
      }
      resolve(
        new Response(Buffer.concat(chunks), {
          status: res.statusCode || 200,
          statusText: res.statusMessage,
          headers,
        })
      )
    }

    res.once('finish', finish)
    res.once('close', () => {
      if (!res.writableEnded) finish()
    })
    res.once('error', reject)
    socket.once('error', reject)

    Promise.resolve(handle(req, res)).catch(reject)
  })
}
