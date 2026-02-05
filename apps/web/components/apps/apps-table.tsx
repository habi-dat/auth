'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import type { getApps } from '@/lib/actions/app-actions'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Key, Lock, Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type AppRow = Awaited<ReturnType<typeof getApps>>[number]

export function AppsTable({ apps }: { apps: AppRow[] }) {
  const t = useTranslations('apps')
  const router = useRouter()

  const columns: ColumnDef<AppRow>[] = [
    {
      accessorKey: 'name',
      header: t('name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.iconUrl ? (
            <img
              src={row.original.iconUrl}
              alt=""
              className="h-6 w-6 rounded object-contain"
              width={24}
              height={24}
            />
          ) : null}
          <div>
            <span className="font-medium">{row.original.name}</span>
            <span className="ml-2 text-sm text-muted-foreground">/{row.original.slug}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'url',
      header: t('url'),
      cell: ({ row }) => (
        <a
          href={row.original.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.url}
          <ExternalLink className="h-3 w-3" />
        </a>
      ),
    },
    {
      id: 'sso',
      header: 'SSO',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.samlEnabled && (
            <Badge variant="secondary" className="gap-0.5 font-normal">
              <Lock className="h-3 w-3" />
              SAML
            </Badge>
          )}
          {row.original.oidcEnabled && (
            <Badge variant="secondary" className="gap-0.5 font-normal">
              <Key className="h-3 w-3" />
              OIDC
            </Badge>
          )}
          {!row.original.samlEnabled && !row.original.oidcEnabled && (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'groupAccess',
      header: t('groupAccess'),
      cell: ({ row }) => {
        const count = row.original.groupAccess.length
        if (count === 0) return <span className="text-muted-foreground text-sm">Alle</span>
        return (
          <span className="text-sm">
            {row.original.groupAccess.slice(0, 2).map((a) => a.group.name).join(', ')}
            {count > 2 ? ` +${count - 2}` : ''}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">{t('actions')}</span>,
      cell: ({ row }) => (
        <Link href={`/apps/${row.original.slug}/edit`} onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm">
            <Pencil className="mr-1 h-4 w-4" />
            {t('edit')}
          </Button>
        </Link>
      ),
      meta: { className: 'text-right' },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={apps}
      emptyMessage={t('noApps')}
      onRowClick={(row) => router.push(`/apps/${row.slug}/edit`)}
    />
  )
}
