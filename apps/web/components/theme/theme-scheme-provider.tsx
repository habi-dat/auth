'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect } from 'react'

export type ThemeScheme = '1' | '2' | '3' | '4'
export type ColorMode = 'light' | 'dark' | 'system'

interface ThemeSchemeProviderProps {
  children: React.ReactNode
  /** Color scheme: 1 (red/black), 2 (feminist), 3 (nature), 4 (blue/grey). */
  initialTheme: ThemeScheme
  /** Light, dark, or system (follow OS). */
  initialColorMode: ColorMode
}

export function ThemeSchemeProvider({
  children,
  initialTheme,
  initialColorMode,
}: ThemeSchemeProviderProps) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [initialTheme])

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={initialColorMode === 'system' ? 'system' : initialColorMode}
      value={{ light: 'light', dark: 'dark', system: 'system' }}
      enableSystem
      disableTransitionOnChange
      storageKey="habidat-color-mode"
    >
      {children}
    </NextThemesProvider>
  )
}
