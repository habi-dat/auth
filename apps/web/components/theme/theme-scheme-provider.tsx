'use client'

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { useEffect } from 'react'
import { generateThemeVariables } from '../../lib/theme-generator'

export type ColorMode = 'light' | 'dark' | 'system'

interface ThemeSchemeProviderProps {
  children: React.ReactNode
  /** Base hex color for the theme. */
  themeColor?: string
  /** Light, dark, or system (follow OS). */
  initialColorMode: ColorMode
}

function DynamicThemeInjector({ themeColor }: { themeColor?: string }) {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const vars = generateThemeVariables(themeColor, resolvedTheme === 'dark' ? 'dark' : 'light')
    const root = document.documentElement
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value)
    }
  }, [themeColor, resolvedTheme])

  return null
}

export function ThemeSchemeProvider({
  children,
  themeColor,
  initialColorMode,
}: ThemeSchemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={initialColorMode === 'system' ? 'system' : initialColorMode}
      value={{ light: 'light', dark: 'dark', system: 'system' }}
      enableSystem
      disableTransitionOnChange
      storageKey="habidat-color-mode"
    >
      <DynamicThemeInjector themeColor={themeColor} />
      {children}
    </NextThemesProvider>
  )
}
