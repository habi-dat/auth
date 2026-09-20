import type * as React from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Card chrome only from `md` up so auth forms sit flush on mobile. */
export function AuthCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        'border-0 bg-transparent shadow-none rounded-none',
        'md:border md:border-border/60 md:bg-card md:shadow-lg md:rounded-lg dark:md:shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
        className
      )}
      {...props}
    />
  )
}

export function AuthCardHeader({ className, ...props }: React.ComponentProps<typeof CardHeader>) {
  return <CardHeader className={cn('px-0 pt-0 md:p-6', className)} {...props} />
}

export function AuthCardContent({ className, ...props }: React.ComponentProps<typeof CardContent>) {
  return <CardContent className={cn('px-0 md:px-6', className)} {...props} />
}

export function AuthCardFooter({ className, ...props }: React.ComponentProps<typeof CardFooter>) {
  return <CardFooter className={cn('px-0 md:px-6', className)} {...props} />
}
