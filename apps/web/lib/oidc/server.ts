import * as http from 'node:http'
import Next from 'next'
import Provider from 'oidc-provider'
import {
  OIDC_ISSUER,
  getOidcConfiguration,
  getOidcClientsFromDb,
  createFindAccount,
  OIDC_INTERACTION_PATH,
} from './config'
import { handleOidcInteraction } from './interaction'

const dev = process.env.NODE_ENV !== 'production'
const port = Number.parseInt(process.env.PORT ?? '3000', 10)

export async function createOidcServer(): Promise<http.Server> {
  const nextApp = Next({ dev, dir: process.cwd() })
  const nextHandle = nextApp.getRequestHandler()
  await nextApp.prepare()

  const clients = await getOidcClientsFromDb()
  const findAccount = createFindAccount()
  const config = getOidcConfiguration(OIDC_ISSUER, clients, findAccount)
  const provider = new Provider(OIDC_ISSUER, config)
  const oidcCallback = provider.callback()

  return http.createServer((req, res) => {
    const url = req.url ?? '/'
    const pathname = url.split('?')[0]

    if (pathname === OIDC_INTERACTION_PATH || pathname.startsWith(`${OIDC_INTERACTION_PATH}/`)) {
      handleOidcInteraction(provider, req, res)
      return
    }
    if (pathname.startsWith('/oidc')) {
      oidcCallback(req, res)
      return
    }
    nextHandle(req, res)
  })
}

export async function startOidcServer(): Promise<void> {
  const server = await createOidcServer()
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
    console.log(`> OIDC issuer: ${OIDC_ISSUER}`)
  })
}
