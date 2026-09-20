import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@habidat/auth', '@habidat/db', '@habidat/env', '@habidat/ldap'],
  serverExternalPackages: ['@prisma/client', 'oidc-provider', 'sharp'],
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  async redirects() {
    return [
      { source: '/lostpasswd', destination: '/forgot-password', permanent: true },
      { source: '/forgot-passwd', destination: '/forgot-password', permanent: true },
    ]
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
