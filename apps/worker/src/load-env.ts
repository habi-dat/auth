/**
 * Load .env before any other imports so DATABASE_URL etc. are set when @habidat/db runs.
 * Loads from apps/worker/.env first, then process.cwd()/.env (e.g. repo root when running via pnpm from root).
 */
import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })
config() // cwd .env (overrides / fills in when running from monorepo root)
