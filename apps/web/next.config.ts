import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@habidat/db', '@habidat/env'],
  serverExternalPackages: ['@prisma/client'],
}

export default withNextIntl(nextConfig)
