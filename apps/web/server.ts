/**
 * Custom server that runs Next.js and the OIDC provider (node-oidc-provider).
 * Use: pnpm dev:oidc (or tsx server.ts)
 * Plain Next.js (no OIDC): pnpm dev
 */
import { startOidcServer } from './lib/oidc/server'

startOidcServer().catch((err) => {
  console.error(err)
  process.exit(1)
})
