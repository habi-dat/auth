'use client'

import { ThemeSchemeProvider } from '@/components/theme/theme-scheme-provider'
import type { ColorMode, ThemeScheme } from '@/components/theme/theme-scheme-provider'
import { Toaster } from '@/components/ui/toaster'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { useState } from 'react'

export function Providers({
  children,
  messages,
  initialTheme,
  initialColorMode,
}: {
  children: React.ReactNode
  messages: Awaited<ReturnType<typeof import('next-intl/server').getMessages>>
  initialTheme: ThemeScheme
  initialColorMode: ColorMode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  return (
    <NextIntlClientProvider locale="de" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <ThemeSchemeProvider
          initialTheme={initialTheme}
          initialColorMode={initialColorMode}
        >
          {children}
          <Toaster />
        </ThemeSchemeProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  )
}
