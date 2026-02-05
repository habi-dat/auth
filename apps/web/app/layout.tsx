import type { Metadata } from 'next'
import { getMessages } from 'next-intl/server'
import { Inter } from 'next/font/google'
import { getCurrentUserThemePreferences } from '@/lib/auth/session'
import { getGeneralSettings } from '@/lib/settings/general'
import type { ThemeScheme } from '@/components/theme/theme-scheme-provider'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

const defaultTitle = 'habidat auth'
const defaultDescription = 'User management and identity provider'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getGeneralSettings()
    const title = settings.platformName?.trim()
      ? `${settings.platformName} – Auth`
      : defaultTitle
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

function parseTheme(v: string | null | undefined): ThemeScheme {
  if (v === '1' || v === '2' || v === '3' || v === '4') return v
  return '1'
}

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
    getGeneralSettings().catch(() => ({ defaultTheme: undefined })),
    getCurrentUserThemePreferences(),
  ])

  const defaultTheme = parseTheme(settings.defaultTheme)
  const initialTheme =
    parseTheme(themePrefs?.preferredTheme ?? settings.defaultTheme) ?? defaultTheme
  const initialColorMode = parseColorMode(themePrefs?.preferredColorMode) ?? 'system'

  return (
    <html lang="de" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers
          messages={messages}
          initialTheme={initialTheme}
          initialColorMode={initialColorMode}
        >
          {children}
        </Providers>
      </body>
    </html>
  )
}
