import type { Metadata } from 'next'
import { getMessages } from 'next-intl/server'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'habidat auth',
  description: 'User management and identity provider',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const messages = await getMessages()

  return (
    <html lang="de" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers messages={messages}>{children}</Providers>
      </body>
    </html>
  )
}
