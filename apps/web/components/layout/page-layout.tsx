import { cn } from '@/lib/utils'

interface PageLayoutProps {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function PageLayout({ title, description, actions, children, className }: PageLayoutProps) {
  return (
    <div className={cn('space-y-6 mx-auto max-w-7xl', className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description != null && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions}
      </div>

      <div>{children}</div>
    </div>
  )
}
