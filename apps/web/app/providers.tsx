'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { useState } from 'react'
import type { ColorMode } from '@/components/theme/theme-scheme-provider'
import { ThemeSchemeProvider } from '@/components/theme/theme-scheme-provider'
import { Toaster } from '@/components/ui/toaster'

export function Providers({
  children,
  messages,
  themeColor,
  initialColorMode,
}: {
  children: React.ReactNode
  messages: Awaited<ReturnType<typeof import('next-intl/server').getMessages>>
  themeColor?: string
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
    <NextIntlClientProvider locale="de" timeZone="Europe/Berlin" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <ThemeSchemeProvider themeColor={themeColor} initialColorMode={initialColorMode}>
          {children}
          <Toaster />
        </ThemeSchemeProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  )
}
