import { Button } from '@/components/ui/button'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function UnauthorizedPage() {
  const t = await getTranslations('common')
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Zugriff verweigert</h1>
      <p className="text-muted-foreground text-center">
        Sie haben keine Berechtigung, auf diese Anwendung zuzugreifen.
      </p>
      <Link href="/">
        <Button>Zurück zur Startseite</Button>
      </Link>
    </div>
  )
}
