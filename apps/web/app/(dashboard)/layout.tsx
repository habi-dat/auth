import { getCurrentUserWithGroups } from '@habidat/auth/session'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { getGeneralSettings } from '@/lib/settings/general'

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

  // Only show sidebar for admins and group admins
  const showSidebar = session.isAdmin || session.isGroupAdmin

  return (
    <div className="flex min-h-screen">
      {showSidebar && (
        <Sidebar
          isAdmin={session.isAdmin}
          isGroupAdmin={session.isGroupAdmin}
          brandName={generalSettings.platformName?.trim() || undefined}
          logoUrl={generalSettings.logoUrl?.trim() || undefined}
          logoUpdatedAt={generalSettings.logoUpdatedAt}
        />
      )}
      <div className="flex-1 flex flex-col">
        <Header user={session.user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
