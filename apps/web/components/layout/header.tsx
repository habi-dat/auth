'use client'

import { signOut } from '@habidat/auth/client'
import { LogOut, Menu, Moon, Settings, Sun, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { getLogoutUrlAction } from '@/lib/actions/auth-actions'
import { updateProfileAction } from '@/lib/actions/user-actions'

interface HeaderProps {
  user: {
    id: string
    name: string
    email: string
    image?: string | null
    preferredColorMode?: string | null
    primaryGroupId?: string | null
    preferredLanguage?: string
  }
  sidebarProps?: {
    isAdmin: boolean
    isGroupAdmin: boolean
    brandName?: string
    logoUrl?: string
    logoUpdatedAt?: string
  }
}

export function Header({ user, sidebarProps }: HeaderProps) {
  const t = useTranslations('header')
  const tProfile = useTranslations('profile')
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()
  const { execute: executeUpdateColorMode } = useAction(updateProfileAction, {
    onSuccess: () => router.refresh(),
  })

  const handleColorMode = (mode: 'light' | 'dark' | 'system') => {
    setTheme(mode === 'system' ? 'system' : mode)
    executeUpdateColorMode({
      name: user.name,
      location: null,
      preferredLanguage: user.preferredLanguage ?? 'de',
      preferredColorMode: mode,
      primaryGroupId: user.primaryGroupId ?? null,
    })
  }

  const handleSignOut = async () => {
    const { logoutUrl } = await getLogoutUrlAction()
    if (logoutUrl) {
      router.push(logoutUrl)
      return
    }
    await signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="border-b bg-card px-6 py-3">
      <div className="flex items-center justify-between w-full">
        {/* Left side: Mobile menu toggle */}
        <div className="flex items-center">
          {sidebarProps && (
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden mr-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle mobile menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-none flex flex-col">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <Sidebar
                  {...sidebarProps}
                  className="w-full border-r-0 md:flex flex-1"
                  onItemClick={() => setIsSidebarOpen(false)}
                />
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* Right side: Profile dropdown */}
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 gap-2 rounded-full px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image || undefined} alt={user.name} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="max-w-[8rem] truncate text-sm font-medium">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {resolvedTheme === 'dark' ? (
                    <Moon className="mr-2 h-4 w-4" />
                  ) : (
                    <Sun className="mr-2 h-4 w-4" />
                  )}
                  <span>{t('colorMode')}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleColorMode('light')}>
                    <Sun className="mr-2 h-4 w-4" />
                    {tProfile('colorModeLight')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleColorMode('dark')}>
                    <Moon className="mr-2 h-4 w-4" />
                    {tProfile('colorModeDark')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleColorMode('system')}>
                    {tProfile('colorModeSystem')}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>{t('profile')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile/edit" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>{t('editProfile')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t('signOut')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
