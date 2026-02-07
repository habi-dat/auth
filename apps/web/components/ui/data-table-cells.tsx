import { Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                                Action Cells                                */
/* -------------------------------------------------------------------------- */

interface RowActionsProps {
  children: ReactNode
  className?: string
}

export function RowActions({ children, className }: RowActionsProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: needed to prevent row click event
    // biome-ignore lint/a11y/useKeyWithClickEvents: needed to prevent row click event
    <div
      className={cn('flex items-center justify-end gap-1', className)}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

interface ActionButtonProps {
  onClick?: () => void
  title: string
  icon?: ReactNode
  variant?: 'ghost' | 'destructive'
  disabled?: boolean
  className?: string
}

export function EditAction({ href, title = 'Edit' }: { href: string; title?: string }) {
  return (
    <Link href={href}>
      <Button variant="ghost" size="icon" title={title}>
        <Pencil className="h-4 w-4" />
      </Button>
    </Link>
  )
}

export function DeleteAction({
  onClick,
  title = 'Delete',
  disabled,
}: {
  onClick: () => void
  title?: string
  disabled?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}

export function GenericAction({ onClick, title, icon, className, disabled }: ActionButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {icon}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 List Rendering                             */
/* -------------------------------------------------------------------------- */

interface BadgeListProps<T> {
  data: T[]
  /** Function to render the label of the badge */
  label: (item: T) => ReactNode
  /** Function to get a unique key for the item. Defaults to `id` if present or strict equality. */
  keyFn?: (item: T) => string | number
  /** Max items to show before +N badge. Default: 3 */
  limit?: number
  variant?: BadgeProps['variant']
  /** Custom class for the badges */
  badgeClassName?: string
  /** Message to show if list is empty. Default: "—" */
  emptyMessage?: ReactNode
}

export function BadgeList<T>({
  data,
  label,
  keyFn,
  limit = 2,
  variant = 'secondary',
  badgeClassName,
  emptyMessage = <span className="text-muted-foreground text-sm">—</span>,
}: BadgeListProps<T>) {
  if (!data || data.length === 0) {
    return <>{emptyMessage}</>
  }

  const visibleItems = data.slice(0, limit)
  const overflowCount = data.length - limit

  const getKey = (item: T, index: number) => {
    if (keyFn) return keyFn(item)
    if (item && typeof item === 'object' && 'id' in item) return item.id as string
    return index
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visibleItems.map((item, i) => (
        <Badge
          key={getKey(item, i)}
          variant={variant}
          className={cn('font-normal', badgeClassName)}
        >
          {label(item)}
        </Badge>
      ))}
      {overflowCount > 0 && (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          +{overflowCount}
        </Badge>
      )}
    </div>
  )
}
