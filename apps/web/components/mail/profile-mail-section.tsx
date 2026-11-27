'use client'

import {
  NOTIFICATION_LEVEL_MUTED,
  NOTIFICATION_LEVEL_WATCHING,
} from '@habidat/discourse/types' // client-safe entry: no node:crypto
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

type ActionResult = { serverError?: unknown } | undefined

/** Run a server action; returns false on thrown errors or serverError. */
async function runAction(action: () => Promise<ActionResult>): Promise<boolean> {
  try {
    const result = await action()
    return !result?.serverError
  } catch {
    return false
  }
}

/** Boolean setting that updates optimistically and rolls back on failure. */
function useOptimisticSwitch(
  initial: boolean,
  save: (value: boolean) => Promise<ActionResult>,
  onError: () => void
) {
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)

  const change = async (next: boolean) => {
    setValue(next)
    setPending(true)
    if (!(await runAction(() => save(next)))) {
      setValue(!next)
      onError()
    }
    setPending(false)
  }

  return { value, pending, change }
}

/** Per-item subscribed state with optimistic updates and rollback on failure. */
function useSubscriptionToggles<K extends string | number>(
  initial: Iterable<readonly [K, boolean]>,
  save: (id: K, subscribed: boolean) => Promise<ActionResult>,
  onError: () => void
) {
  const [subscribed, setSubscribed] = useState(() => new Map(initial))
  const [pending, setPending] = useState<Set<K>>(new Set())

  const toggle = useCallback(
    async (id: K, next: boolean) => {
      const set = (value: boolean) => setSubscribed((current) => new Map(current).set(id, value))

      set(next)
      setPending((p) => new Set(p).add(id))

      if (!(await runAction(() => save(id, next)))) {
        set(!next)
        onError()
      }

      setPending((p) => {
        const rest = new Set(p)
        rest.delete(id)
        return rest
      })
    },
    [save, onError]
  )

  return {
    isSubscribed: (id: K) => subscribed.get(id) ?? false,
    isPending: (id: K) => pending.has(id),
    toggle,
  }
}

const saveEchoOwnPosts = (echo: boolean) => toggleEchoOwnMessagesAction({ echo })
const saveCategory = (categoryId: number, subscribed: boolean) =>
  setCategorySubscriptionAction({ categoryId, subscribed })
const saveTag = (tagName: string, subscribed: boolean) =>
  setTagSubscriptionAction({ tagName, subscribed })
const saveGroup = (groupName: string, subscribed: boolean) =>
  setGroupSubscriptionAction({ groupName, subscribed })

export function ProfileMailSection({ initialData }: { initialData: MailSwitchData }) {
  const t = useTranslations('mailSettings')
  const { toast } = useToast()

  const showMailError = useCallback(() => {
    toast({ title: t('errorTitle'), description: t('errorGeneric'), variant: 'destructive' })
  }, [t, toast])

  const echoOwnPosts = useOptimisticSwitch(
    initialData.echoOwnPosts,
    saveEchoOwnPosts,
    showMailError
  )
  // Enabling also writes the frequency from the echo switch (never the daily digest).
  const echoValue = echoOwnPosts.value
  const saveMailingListMode = useCallback(
    (enabled: boolean) => toggleMailingListModeAction({ enabled, echoOwnPosts: echoValue }),
    [echoValue]
  )
  const mailingListMode = useOptimisticSwitch(
    initialData.mailingListMode,
    saveMailingListMode,
    showMailError
  )

  // Mailing list mode mails every post except muted categories/tags, so those
  // count as subscribed unless muted. Group inboxes are only mailed when watched.
  const categories = useSubscriptionToggles(
    initialData.categories.map((c) => [c.id, c.notification_level !== NOTIFICATION_LEVEL_MUTED] as const),
    saveCategory,
    showMailError
  )
  const mutedTags = new Set(
    initialData.tagNotifications
      .filter((n) => n.notification_level === NOTIFICATION_LEVEL_MUTED)
      .map((n) => n.tag_name)
  )
  const tags = useSubscriptionToggles(
    initialData.allTags.map((tg) => [tg.name, !mutedTags.has(tg.name)] as const),
    saveTag,
    showMailError
  )
  const groups = useSubscriptionToggles(
    initialData.groups.map((g) => [g.name, g.notification_level === NOTIFICATION_LEVEL_WATCHING] as const),
    saveGroup,
    showMailError
  )

  const handleToggle = useCallback(
    (item: SubscriptionItem, subscribed: boolean) => {
      if (item.kind === 'category') return categories.toggle(item.id as number, subscribed)
      if (item.kind === 'tag') return tags.toggle(item.id as string, subscribed)
      return groups.toggle(item.id as string, subscribed)
    },
    [categories.toggle, tags.toggle, groups.toggle]
  )

  const categoryItems: SubscriptionItem[] = initialData.categories.map((c) => ({
    id: c.id,
    kind: 'category' as const,
    name: c.name,
    color: c.color,
    description: c.description_text ?? undefined,
    email: c.email_in,
    subscribed: categories.isSubscribed(c.id),
    pending: categories.isPending(c.id),
  }))

  const tagItems: SubscriptionItem[] = initialData.allTags.map((tag) => ({
    id: tag.name,
    kind: 'tag' as const,
    name: tag.name,
    description: tag.description ?? undefined,
    subscribed: tags.isSubscribed(tag.name),
    pending: tags.isPending(tag.name),
  }))

  const groupItems: SubscriptionItem[] = initialData.groups.map((g) => ({
    id: g.name,
    kind: 'group' as const,
    name: g.display_name || g.name,
    email: g.incoming_email,
    description: g.bio_excerpt,
    subscribed: groups.isSubscribed(g.name),
    pending: groups.isPending(g.name),
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
            checked={mailingListMode.value}
            disabled={mailingListMode.pending}
            onCheckedChange={mailingListMode.change}
            className="mt-0.5 shrink-0"
          />
        </div>
      </CardHeader>

      {/* CSS grid row collapse — smooth height animation without a fixed max-height */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          mailingListMode.value ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
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
                  checked={echoOwnPosts.value}
                  disabled={echoOwnPosts.pending}
                  onCheckedChange={echoOwnPosts.change}
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
