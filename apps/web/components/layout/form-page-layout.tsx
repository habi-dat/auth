import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FormPageLayoutProps {
  backHref: string
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function FormPageLayout({
  backHref,
  title,
  description,
  children,
  className,
}: FormPageLayoutProps) {
  return (
    <div className={cn('mx-auto space-y-6', className ?? 'max-w-4xl')}>
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="icon" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description != null && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>

      {children}
    </div>
  )
}
