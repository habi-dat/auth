import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { getCurrentUserWithGroups } from '@/lib/auth/session'
import { getGeneralSettings } from '@/lib/settings/general'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, generalSettings] = await Promise.all([
    getCurrentUserWithGroups(),
    getGeneralSettings().catch(() => ({
      platformName: undefined,
      logoUrl: undefined,
      logoUpdatedAt: undefined,
    })),
  ])

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isAdmin={session.isAdmin}
        isGroupAdmin={session.isGroupAdmin}
        brandName={generalSettings.platformName?.trim() || undefined}
        logoUrl={generalSettings.logoUrl?.trim() || undefined}
        logoUpdatedAt={generalSettings.logoUpdatedAt}
      />
      <div className="flex-1 flex flex-col">
        <Header user={session.user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
