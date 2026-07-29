'use client'

import { useTranslations } from 'next-intl'
import { useQueryState } from 'nuqs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export interface SubscriptionItem {
  id: string | number
  name: string
  color?: string
  email?: string | null
  description?: string | null
  subscribed: boolean
  pending: boolean
}

interface SubscriptionListProps {
  items: SubscriptionItem[]
  filterKey: string
  onToggle: (id: string | number, subscribed: boolean) => void
}

export function SubscriptionList({ items, filterKey, onToggle }: SubscriptionListProps) {
  const t = useTranslations('mailSettings')
  const [filter, setFilter] = useQueryState(filterKey, { defaultValue: '', shallow: true })

  const filtered = filter.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()))
    : items

  return (
    <div className="space-y-3">
      <Input
        placeholder={t('filterPlaceholder')}
        value={filter}
        onChange={(e) => setFilter(e.target.value || null)}
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t('noResults')}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {filtered.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {item.color && (
                  <span
                    className="h-3 w-3 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: `#${item.color}` }}
                  />
                )}
                <div className="min-w-0">
                  <Label
                    htmlFor={`sub-${item.id}`}
                    className="font-normal cursor-pointer block truncate"
                  >
                    {item.name}
                  </Label>
                  {item.email && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{item.email}</p>
                  )}
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
              <Switch
                id={`sub-${item.id}`}
                checked={item.subscribed}
                disabled={item.pending}
                onCheckedChange={(checked) => onToggle(item.id, checked)}
                className="shrink-0"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
