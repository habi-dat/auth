'use client'

import type {
  DiscourseCategoryWithNotification,
  DiscourseGroupBasic,
  DiscourseTagBasic,
  DiscourseTagNotification,
} from '@habidat/discourse'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import {
  setCategorySubscriptionAction,
  setGroupSubscriptionAction,
  setTagSubscriptionAction,
  toggleMailingListModeAction,
} from '@/lib/actions/discourse-mail-actions'
import { type SubscriptionItem, SubscriptionList } from './subscription-list'

interface MailSwitchPageProps {
  initialData: {
    mailingListMode: boolean
    categories: DiscourseCategoryWithNotification[]
    allTags: DiscourseTagBasic[]
    tagNotifications: DiscourseTagNotification[]
    groups: DiscourseGroupBasic[]
  }
}

const WATCHING = 3

export function MailSwitchPage({ initialData }: MailSwitchPageProps) {
  const t = useTranslations('mailSettings')
  const { toast } = useToast()

  const [mailingListMode, setMailingListMode] = useState(initialData.mailingListMode)
  const [mlmPending, setMlmPending] = useState(false)

  // Track subscribed state and pending toggles for each item type
  const [categoryLevels, setCategoryLevels] = useState<Record<number, 0 | 1 | 2 | 3 | 4>>(
    () => Object.fromEntries(initialData.categories.map((c) => [c.id, c.notification_level ?? 1]))
  )
  const [categoryPending, setCategoryPending] = useState<Set<number>>(new Set())

  const tagNotifMap = Object.fromEntries(
    initialData.tagNotifications.map((n) => [n.tag_name, n.notification_level])
  )
  const [tagLevels, setTagLevels] = useState<Record<string, 0 | 1 | 2 | 3 | 4>>(
    () => Object.fromEntries(initialData.allTags.map((t) => [t.name, tagNotifMap[t.name] ?? 1]))
  )
  const [tagPending, setTagPending] = useState<Set<string>>(new Set())

  const [groupLevels, setGroupLevels] = useState<Record<string, 0 | 1 | 2 | 3 | 4>>(
    () => Object.fromEntries(initialData.groups.map((g) => [g.name, g.notification_level ?? 1]))
  )
  const [groupPending, setGroupPending] = useState<Set<string>>(new Set())

  const handleMailingListMode = async (enabled: boolean) => {
    setMailingListMode(enabled)
    setMlmPending(true)
    const result = await toggleMailingListModeAction({ enabled })
    setMlmPending(false)
    if (result?.serverError) {
      setMailingListMode(!enabled)
      toast({ title: t('errorTitle'), description: result.serverError, variant: 'destructive' })
    }
  }

  const handleCategoryToggle = useCallback(
    async (id: string | number, subscribed: boolean) => {
      const catId = id as number
      const prev = categoryLevels[catId]
      setCategoryLevels((l) => ({ ...l, [catId]: subscribed ? WATCHING : 1 }))
      setCategoryPending((p) => new Set(p).add(catId))
      const result = await setCategorySubscriptionAction({ categoryId: catId, subscribed })
      setCategoryPending((p) => { const next = new Set(p); next.delete(catId); return next })
      if (result?.serverError) {
        setCategoryLevels((l) => ({ ...l, [catId]: prev }))
        toast({ title: t('errorTitle'), description: result.serverError, variant: 'destructive' })
      }
    },
    [categoryLevels, t, toast]
  )

  const handleTagToggle = useCallback(
    async (id: string | number, subscribed: boolean) => {
      const tagName = id as string
      const prev = tagLevels[tagName]
      setTagLevels((l) => ({ ...l, [tagName]: subscribed ? WATCHING : 1 }))
      setTagPending((p) => new Set(p).add(tagName))
      const result = await setTagSubscriptionAction({ tagName, subscribed })
      setTagPending((p) => { const next = new Set(p); next.delete(tagName); return next })
      if (result?.serverError) {
        setTagLevels((l) => ({ ...l, [tagName]: prev }))
        toast({ title: t('errorTitle'), description: result.serverError, variant: 'destructive' })
      }
    },
    [tagLevels, t, toast]
  )

  const handleGroupToggle = useCallback(
    async (id: string | number, subscribed: boolean) => {
      const groupName = id as string
      const prev = groupLevels[groupName]
      setGroupLevels((l) => ({ ...l, [groupName]: subscribed ? WATCHING : 1 }))
      setGroupPending((p) => new Set(p).add(groupName))
      const result = await setGroupSubscriptionAction({ groupName, subscribed })
      setGroupPending((p) => { const next = new Set(p); next.delete(groupName); return next })
      if (result?.serverError) {
        setGroupLevels((l) => ({ ...l, [groupName]: prev }))
        toast({ title: t('errorTitle'), description: result.serverError, variant: 'destructive' })
      }
    },
    [groupLevels, t, toast]
  )

  const handleToggle = useCallback(
    (item: SubscriptionItem, subscribed: boolean) => {
      if (item.kind === 'category') return handleCategoryToggle(item.id, subscribed)
      if (item.kind === 'tag') return handleTagToggle(item.id, subscribed)
      return handleGroupToggle(item.id, subscribed)
    },
    [handleCategoryToggle, handleTagToggle, handleGroupToggle]
  )

  const categoryItems: SubscriptionItem[] = initialData.categories.map((c) => ({
    id: c.id,
    kind: 'category' as const,
    name: c.name,
    color: c.color,
    email: c.email_in,
    subscribed: (categoryLevels[c.id] ?? 1) >= WATCHING,
    pending: categoryPending.has(c.id),
  }))

  const tagItems: SubscriptionItem[] = initialData.allTags.map((tag) => ({
    id: tag.name,
    kind: 'tag' as const,
    name: tag.name,
    subscribed: (tagLevels[tag.name] ?? 1) >= WATCHING,
    pending: tagPending.has(tag.name),
  }))

  const groupItems: SubscriptionItem[] = initialData.groups.map((g) => ({
    id: g.name,
    kind: 'group' as const,
    name: g.display_name || g.name,
    email: g.incoming_email,
    description: g.bio_excerpt,
    subscribed: (groupLevels[g.name] ?? 1) >= WATCHING,
    pending: groupPending.has(g.name),
  }))

  const allItems: SubscriptionItem[] = [...categoryItems, ...groupItems, ...tagItems]

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('mailingListMode.title')}</CardTitle>
          <CardDescription>{t('mailingListMode.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="mailing-list-mode"
              checked={mailingListMode}
              disabled={mlmPending}
              onCheckedChange={handleMailingListMode}
            />
            <Label htmlFor="mailing-list-mode">
              {mailingListMode ? t('mailingListMode.on') : t('mailingListMode.off')}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('subscriptions.title')}</CardTitle>
          <CardDescription>{t('subscriptions.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionList items={allItems} filterKey="sf" onToggle={handleToggle} />
        </CardContent>
      </Card>
    </div>
  )
}
