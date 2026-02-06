'use client'

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
import { updateProfileAction } from '@/lib/actions/user-actions'
import { signOut } from '@/lib/auth-client'
import { LogOut, Moon, Settings, Sun, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  user: {
    id: string
    name: string
    email: string
    image?: string | null
    preferredTheme?: string | null
    preferredColorMode?: string | null
    primaryGroupId?: string | null
    preferredLanguage?: string
  }
}

export function Header({ user }: HeaderProps) {
  const t = useTranslations('header')
  const tProfile = useTranslations('profile')
  const router = useRouter()
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
      preferredTheme: user.preferredTheme ?? null,
      preferredColorMode: mode,
      primaryGroupId: user.primaryGroupId ?? null,
    })
  }

  const handleSignOut = async () => {
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
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar>
                <AvatarImage src={user.image || undefined} alt={user.name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
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
    </header>
  )
}
