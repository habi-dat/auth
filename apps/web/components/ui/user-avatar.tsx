'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarDisplaySrc, userInitials } from '@/lib/avatar/display'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  image?: string | null
  updatedAt?: Date | string | number | null
  className?: string
  fallbackClassName?: string
}

export function UserAvatar({
  name,
  image,
  updatedAt,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  return (
    <Avatar className={className}>
      <AvatarImage src={avatarDisplaySrc(image, updatedAt)} alt={name} />
      <AvatarFallback className={cn(fallbackClassName)}>{userInitials(name)}</AvatarFallback>
    </Avatar>
  )
}
