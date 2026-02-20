'use client'

import {
  FileText,
  FolderTree,
  History,
  Home,
  Layers,
  Mail,
  RefreshCw,
  Settings,
  User,
  Users,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface SidebarProps {
  isAdmin?: boolean
  isGroupAdmin?: boolean
  /** Platform name from general settings; falls back to sidebar.brand */
  brandName?: string
  /** Logo URL from general settings (e.g. /uploads/logo.png) */
  logoUrl?: string
  /** Cache-buster so sidebar logo updates after upload (e.g. Setting.updatedAt) */
  logoUpdatedAt?: string
}

export function Sidebar({
  isAdmin = false,
  isGroupAdmin = false,
  brandName,
  logoUrl,
  logoUpdatedAt,
}: SidebarProps) {
  const t = useTranslations('sidebar')
  const pathname = usePathname()
  const displayName = brandName ?? t('brand')

  const navItems = [
    { href: '/', labelKey: 'nav.home', icon: Home },
    { href: '/profile', labelKey: 'nav.profile', icon: User },
    { href: '/users', labelKey: 'nav.users', icon: Users, adminOnly: true },
    { href: '/groups', labelKey: 'nav.groups', icon: FolderTree },
    { href: '/categories', labelKey: 'nav.categories', icon: Layers, adminOnly: true },
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
          {logoUrl ? (
            <div className="flex h-16 w-16 p-2 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg">
              <Image
                src={logoUpdatedAt ? `${logoUrl}?v=${logoUpdatedAt}` : logoUrl}
                alt=""
                className="h-full w-full object-contain"
                width={64}
                height={64}
              />
            </div>
          ) : (
            <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="font-semibold text-lg truncate">{displayName}</span>
        </Link>
      </div>
      <nav className="px-3">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            // For home, only exact match; for others, also match subpaths
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
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
