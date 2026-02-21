import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@habidat/db', '@habidat/env'],
  serverExternalPackages: ['@prisma/client'],
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  allowedDevOrigins: ['http://localhost:3000', 'https://user.habidat.local'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    localPatterns: [
      {
        pathname: '/uploads/**',
      },
      {
        pathname: '/api/uploads/**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
