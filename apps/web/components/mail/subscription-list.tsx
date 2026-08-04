'use client'

import { Layers, Tag, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export interface SubscriptionItem {
  id: string | number
  kind: 'category' | 'tag' | 'group'
  name: string
  color?: string
  email?: string | null
  description?: string | null
  subscribed: boolean
  pending: boolean
}

const KindIcon = ({ kind }: { kind: SubscriptionItem['kind'] }) => {
  if (kind === 'category') return <Layers className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
  if (kind === 'tag') return <Tag className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
  return <Users className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
}

interface SubscriptionListProps {
  items: SubscriptionItem[]
  filterKey: string
  onToggle: (item: SubscriptionItem, subscribed: boolean) => void
}

type Kind = SubscriptionItem['kind']

export function SubscriptionList({ items, filterKey, onToggle }: SubscriptionListProps) {
  const t = useTranslations('mailSettings')
  const [filter, setFilter] = useQueryState(filterKey, { defaultValue: '', shallow: true })
  const [kindFilter, setKindFilter] = useState<Kind | 'all'>('all')
  const [subscribedFilter, setSubscribedFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all')

  const filtered = items
    .filter((i) => kindFilter === 'all' || i.kind === kindFilter)
    .filter((i) => subscribedFilter === 'all' || (subscribedFilter === 'subscribed' ? i.subscribed : !i.subscribed))
    .filter((i) => {
      if (!filter.trim()) return true
      const q = filter.toLowerCase()
      return i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)
    })

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as Kind | 'all')}>
            <SelectTrigger className="flex-1 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('kindFilter.all')}</SelectItem>
              <SelectItem value="group">
                <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{t('kindFilter.groups')}</span>
              </SelectItem>
              <SelectItem value="category">
                <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />{t('kindFilter.categories')}</span>
              </SelectItem>
              <SelectItem value="tag">
                <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />{t('kindFilter.tags')}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={subscribedFilter} onValueChange={(v) => setSubscribedFilter(v as typeof subscribedFilter)}>
            <SelectTrigger className="flex-1 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('subscribedFilter.all')}</SelectItem>
              <SelectItem value="subscribed">{t('subscribedFilter.subscribed')}</SelectItem>
              <SelectItem value="unsubscribed">{t('subscribedFilter.unsubscribed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder={t('filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value || null)}
          className="h-8 text-sm"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t('noResults')}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {filtered.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <KindIcon kind={item.kind} />
                <div className="min-w-0">
                  <Label
                    htmlFor={`sub-${item.kind}-${item.id}`}
                    className="font-normal cursor-pointer block truncate"
                  >
                    {item.name}
                  </Label>
                  {item.email && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{item.email}</p>
                  )}
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
              <Switch
                id={`sub-${item.kind}-${item.id}`}
                checked={item.subscribed}
                disabled={item.pending}
                onCheckedChange={(checked) => onToggle(item, checked)}
                className="shrink-0"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
