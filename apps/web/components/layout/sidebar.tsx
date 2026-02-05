'use client'

import { cn } from '@/lib/utils'
import { FileText, FolderTree, History, Mail, RefreshCw, Settings, User, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  isAdmin?: boolean
  isGroupAdmin?: boolean
}

export function Sidebar({ isAdmin = false, isGroupAdmin = false }: SidebarProps) {
  const t = useTranslations('sidebar')
  const pathname = usePathname()

  const navItems = [
    { href: '/', labelKey: 'nav.profile', icon: User },
    { href: '/users', labelKey: 'nav.users', icon: Users, adminOnly: true },
    { href: '/groups', labelKey: 'nav.groups', icon: FolderTree },
    { href: '/invites', labelKey: 'nav.invites', icon: Mail, groupAdminOnly: true },
    { href: '/apps', labelKey: 'nav.apps', icon: FileText, adminOnly: true },
    { href: '/settings', labelKey: 'nav.settings', icon: Settings, adminOnly: true },
    { href: '/audit', labelKey: 'nav.audit', icon: History, adminOnly: true },
    { href: '/sync', labelKey: 'nav.sync', icon: RefreshCw, adminOnly: true },
  ]

  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.groupAdminOnly && !isAdmin && !isGroupAdmin) return false
    return true
  })

  return (
    <aside className="w-64 border-r bg-card hidden md:block">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">H</span>
          </div>
          <span className="font-semibold text-lg">{t('brand')}</span>
        </Link>
      </div>
      <nav className="px-3">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
