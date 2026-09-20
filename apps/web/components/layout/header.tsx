'use client'

import { ChevronDown, LogOut, Menu, Moon, Settings, Sun, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
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
import { UserAvatar } from '@/components/ui/user-avatar'
import { updateProfileAction } from '@/lib/actions/user-actions'
import { performSignOut } from '@/lib/auth/perform-sign-out'

interface HeaderProps {
  user: {
    id: string
    name: string
    email: string
    image?: string | null
    updatedAt?: Date | string | null
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

  const handleSignOut = () => performSignOut(router)

  return (
    <header className="border-b bg-muted/40 px-6 py-3">
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
                  className="w-full min-h-full border-r-0 md:flex flex-1"
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
              <Button variant="outline" className="relative h-11 gap-2.5 rounded-md px-2 pr-3">
                <UserAvatar
                  name={user.name}
                  image={user.image}
                  updatedAt={user.updatedAt}
                  className="h-9 w-9"
                  fallbackClassName="bg-primary text-primary-foreground text-xs font-semibold"
                />
                <span className="max-w-[10rem] truncate text-sm font-semibold">{user.name}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
