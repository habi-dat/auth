import { Card, CardContent } from '@/components/ui/card'

interface ListPageLayoutProps {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}

export function ListPageLayout({ title, description, actions, children }: ListPageLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description != null && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions}
      </div>

      <Card>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    </div>
  )
}
