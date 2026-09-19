'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import {
  type MailSwitchData,
  setCategorySubscriptionAction,
  setGroupSubscriptionAction,
  setTagSubscriptionAction,
  toggleEchoOwnMessagesAction,
  toggleMailingListModeAction,
} from '@/lib/actions/discourse-mail-actions'
import { cn } from '@/lib/utils'
import { type SubscriptionItem, SubscriptionList } from './subscription-list'

const WATCHING = 3

export function ProfileMailSection({ initialData }: { initialData: MailSwitchData }) {
  const t = useTranslations('mailSettings')
  const { toast } = useToast()

  const [mailingListMode, setMailingListMode] = useState(initialData.mailingListMode)
  const [mlmPending, setMlmPending] = useState(false)
  const [echoOwnPosts, setEchoOwnPosts] = useState(initialData.echoOwnPosts)
  const [echoPending, setEchoPending] = useState(false)

  const [categoryLevels, setCategoryLevels] = useState<Record<number, 0 | 1 | 2 | 3 | 4>>(() =>
    Object.fromEntries(initialData.categories.map((c) => [c.id, c.notification_level ?? 1]))
  )
  const [categoryPending, setCategoryPending] = useState<Set<number>>(new Set())

  const tagNotifMap = Object.fromEntries(
    initialData.tagNotifications.map((n) => [n.tag_name, n.notification_level])
  )
  const [tagLevels, setTagLevels] = useState<Record<string, 0 | 1 | 2 | 3 | 4>>(() =>
    Object.fromEntries(initialData.allTags.map((tg) => [tg.name, tagNotifMap[tg.name] ?? 1]))
  )
  const [tagPending, setTagPending] = useState<Set<string>>(new Set())

  const [groupLevels, setGroupLevels] = useState<Record<string, 0 | 1 | 2 | 3 | 4>>(() =>
    Object.fromEntries(initialData.groups.map((g) => [g.name, g.notification_level ?? 1]))
  )
  const [groupPending, setGroupPending] = useState<Set<string>>(new Set())

  const showMailError = useCallback(() => {
    toast({ title: t('errorTitle'), description: t('errorGeneric'), variant: 'destructive' })
  }, [t, toast])

  const handleMailingListMode = async (enabled: boolean) => {
    setMailingListMode(enabled)
    setMlmPending(true)
    try {
      const result = await toggleMailingListModeAction({ enabled })
      if (result?.serverError) {
        setMailingListMode(!enabled)
        showMailError()
      }
    } catch {
      setMailingListMode(!enabled)
      showMailError()
    } finally {
      setMlmPending(false)
    }
  }

  const handleEchoOwnPosts = async (echo: boolean) => {
    setEchoOwnPosts(echo)
    setEchoPending(true)
    try {
      const result = await toggleEchoOwnMessagesAction({ echo })
      if (result?.serverError) {
        setEchoOwnPosts(!echo)
        showMailError()
      }
    } catch {
      setEchoOwnPosts(!echo)
      showMailError()
    } finally {
      setEchoPending(false)
    }
  }

  const handleCategoryToggle = useCallback(
    async (id: string | number, subscribed: boolean) => {
      const catId = id as number
      const prev = categoryLevels[catId]
      setCategoryLevels((l) => ({ ...l, [catId]: subscribed ? WATCHING : 1 }))
      setCategoryPending((p) => new Set(p).add(catId))
      try {
        const result = await setCategorySubscriptionAction({ categoryId: catId, subscribed })
        if (result?.serverError) {
          setCategoryLevels((l) => ({ ...l, [catId]: prev }))
          showMailError()
        }
      } catch {
        setCategoryLevels((l) => ({ ...l, [catId]: prev }))
        showMailError()
      } finally {
        setCategoryPending((p) => {
          const next = new Set(p)
          next.delete(catId)
          return next
        })
      }
    },
    [categoryLevels, showMailError]
  )

  const handleTagToggle = useCallback(
    async (id: string | number, subscribed: boolean) => {
      const tagName = id as string
      const prev = tagLevels[tagName]
      setTagLevels((l) => ({ ...l, [tagName]: subscribed ? WATCHING : 1 }))
      setTagPending((p) => new Set(p).add(tagName))
      try {
        const result = await setTagSubscriptionAction({ tagName, subscribed })
        if (result?.serverError) {
          setTagLevels((l) => ({ ...l, [tagName]: prev }))
          showMailError()
        }
      } catch {
        setTagLevels((l) => ({ ...l, [tagName]: prev }))
        showMailError()
      } finally {
        setTagPending((p) => {
          const next = new Set(p)
          next.delete(tagName)
          return next
        })
      }
    },
    [tagLevels, showMailError]
  )

  const handleGroupToggle = useCallback(
    async (id: string | number, subscribed: boolean) => {
      const groupName = id as string
      const prev = groupLevels[groupName]
      setGroupLevels((l) => ({ ...l, [groupName]: subscribed ? WATCHING : 1 }))
      setGroupPending((p) => new Set(p).add(groupName))
      try {
        const result = await setGroupSubscriptionAction({ groupName, subscribed })
        if (result?.serverError) {
          setGroupLevels((l) => ({ ...l, [groupName]: prev }))
          showMailError()
        }
      } catch {
        setGroupLevels((l) => ({ ...l, [groupName]: prev }))
        showMailError()
      } finally {
        setGroupPending((p) => {
          const next = new Set(p)
          next.delete(groupName)
          return next
        })
      }
    },
    [groupLevels, showMailError]
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
    description: c.description_text ?? undefined,
    email: c.email_in,
    subscribed: (categoryLevels[c.id] ?? 1) === WATCHING,
    pending: categoryPending.has(c.id),
  }))

  const tagItems: SubscriptionItem[] = initialData.allTags.map((tag) => ({
    id: tag.name,
    kind: 'tag' as const,
    name: tag.name,
    description: tag.description ?? undefined,
    subscribed: (tagLevels[tag.name] ?? 1) === WATCHING,
    pending: tagPending.has(tag.name),
  }))

  const groupItems: SubscriptionItem[] = initialData.groups.map((g) => ({
    id: g.name,
    kind: 'group' as const,
    name: g.display_name || g.name,
    email: g.incoming_email,
    description: g.bio_excerpt,
    subscribed: (groupLevels[g.name] ?? 1) === WATCHING,
    pending: groupPending.has(g.name),
  }))

  const allItems: SubscriptionItem[] = [...categoryItems, ...groupItems, ...tagItems]

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base">{t('mailingListMode.title')}</CardTitle>
            <CardDescription className="text-sm leading-snug">
              {t('mailingListMode.description')}
            </CardDescription>
          </div>
          <Switch
            id="profile-mailing-list-mode"
            checked={mailingListMode}
            disabled={mlmPending}
            onCheckedChange={handleMailingListMode}
            className="mt-0.5 shrink-0"
          />
        </div>
      </CardHeader>

      {/* CSS grid row collapse — smooth height animation without a fixed max-height */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          mailingListMode ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="pt-0">
            <div className="pt-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium leading-none">{t('echoOwnMessages.title')}</p>
                  <p className="text-sm text-muted-foreground leading-snug">
                    {t('echoOwnMessages.description')}
                  </p>
                </div>
                <Switch
                  id="profile-echo-own-messages"
                  checked={echoOwnPosts}
                  disabled={echoPending}
                  onCheckedChange={handleEchoOwnPosts}
                  className="mt-0.5 shrink-0"
                />
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="text-base font-semibold">{t('subscriptions.title')}</p>
                <p className="text-sm text-muted-foreground leading-snug">
                  {t('subscriptions.description')}
                </p>
              </div>
              <SubscriptionList items={allItems} filterKey="sf" onToggle={handleToggle} />
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
