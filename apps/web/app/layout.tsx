import { getCurrentUserThemePreferences } from '@habidat/auth/session'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { getMessages } from 'next-intl/server'
import { getGeneralSettings } from '@/lib/settings/general'
import { generateThemeVariables } from '@/lib/theme-generator'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

const defaultTitle = 'habidat auth'
const defaultDescription = 'User management and identity provider'

// Disable static generation at build time (no DATABASE_URL/env needed in Docker build)
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getGeneralSettings()
    const title = settings.platformName?.trim() ? `${settings.platformName} – Auth` : defaultTitle
    const icons = settings.logoUrl
      ? { icon: settings.logoUrl, shortcut: settings.logoUrl, apple: settings.logoUrl }
      : undefined
    return {
      title,
      description: defaultDescription,
      ...(icons && { icons }),
    }
  } catch {
    return { title: defaultTitle, description: defaultDescription }
  }
}

type ColorMode = 'light' | 'dark' | 'system'

function parseColorMode(v: string | null | undefined): ColorMode {
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return 'system'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [messages, settings, themePrefs] = await Promise.all([
    getMessages(),
    getGeneralSettings().catch(() => ({ themeColor: undefined, showWidgetInAuthApp: undefined })),
    getCurrentUserThemePreferences(),
  ])

  const initialColorMode = parseColorMode(themePrefs?.preferredColorMode) ?? 'system'
  const themeClass =
    initialColorMode === 'dark' ? 'dark' : initialColorMode === 'light' ? 'light' : ''

  const lightVars = generateThemeVariables(settings.themeColor, 'light')
  const darkVars = generateThemeVariables(settings.themeColor, 'dark')

  const css = `
    :root {
      ${Object.entries(lightVars)
        .map(([k, v]) => `${k}: ${v};`)
        .join('\n      ')}
    }
    .dark {
      ${Object.entries(darkVars)
        .map(([k, v]) => `${k}: ${v};`)
        .join('\n      ')}
    }
  `

  return (
    <html lang="de" suppressHydrationWarning className={themeClass}>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: needed */}
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body className={inter.className}>
        <Providers
          messages={messages}
          themeColor={settings.themeColor}
          initialColorMode={initialColorMode}
        >
          {children}
          {settings.showWidgetInAuthApp && <script src="/api/widget/script" defer />}
        </Providers>
      </body>
    </html>
  )
}
