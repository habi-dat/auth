'use client'

import type {
  DiscourseCategoryWithNotification,
  DiscourseGroupBasic,
  DiscourseTagBasic,
  DiscourseTagNotification,
} from '@habidat/discourse'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import {
  setCategorySubscriptionAction,
  setGroupSubscriptionAction,
  setTagSubscriptionAction,
  toggleEchoOwnMessagesAction,
  toggleMailingListModeAction,
} from '@/lib/actions/discourse-mail-actions'
import { type SubscriptionItem, SubscriptionList } from './subscription-list'

export interface MailSwitchData {
  mailingListMode: boolean
  echoOwnPosts: boolean
  categories: DiscourseCategoryWithNotification[]
  allTags: DiscourseTagBasic[]
  tagNotifications: DiscourseTagNotification[]
  groups: DiscourseGroupBasic[]
}

const WATCHING = 3

export function ProfileMailSection({ initialData }: { initialData: MailSwitchData }) {
  const t = useTranslations('mailSettings')
  const { toast } = useToast()

  const [mailingListMode, setMailingListMode] = useState(initialData.mailingListMode)
  const [mlmPending, setMlmPending] = useState(false)
  const [echoOwnPosts, setEchoOwnPosts] = useState(initialData.echoOwnPosts)
  const [echoPending, setEchoPending] = useState(false)

  const [categoryLevels, setCategoryLevels] = useState<Record<number, 0 | 1 | 2 | 3 | 4>>(
    () => Object.fromEntries(initialData.categories.map((c) => [c.id, c.notification_level ?? 1]))
  )
  const [categoryPending, setCategoryPending] = useState<Set<number>>(new Set())

  const tagNotifMap = Object.fromEntries(
    initialData.tagNotifications.map((n) => [n.tag_name, n.notification_level])
  )
  const [tagLevels, setTagLevels] = useState<Record<string, 0 | 1 | 2 | 3 | 4>>(
    () => Object.fromEntries(initialData.allTags.map((tg) => [tg.name, tagNotifMap[tg.name] ?? 1]))
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
    } else if (result?.data?.subscribedGroups?.length) {
      const subscribed = result.data.subscribedGroups
      setGroupLevels((prev) => {
        const next = { ...prev }
        for (const name of subscribed) next[name] = WATCHING
        return next
      })
    }
  }

  const handleEchoOwnPosts = async (echo: boolean) => {
    setEchoOwnPosts(echo)
    setEchoPending(true)
    const result = await toggleEchoOwnMessagesAction({ echo })
    setEchoPending(false)
    if (result?.serverError) {
      setEchoOwnPosts(!echo)
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

  const categoryItems: SubscriptionItem[] = initialData.categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    email: c.email_in,
    subscribed: (categoryLevels[c.id] ?? 1) >= WATCHING,
    pending: categoryPending.has(c.id),
  }))

  const tagItems: SubscriptionItem[] = initialData.allTags.map((tag) => ({
    id: tag.name,
    name: tag.name,
    subscribed: (tagLevels[tag.name] ?? 1) >= WATCHING,
    pending: tagPending.has(tag.name),
  }))

  const groupItems: SubscriptionItem[] = initialData.groups.map((g) => ({
    id: g.name,
    name: g.display_name || g.name,
    email: g.incoming_email,
    description: g.bio_excerpt,
    subscribed: (groupLevels[g.name] ?? 1) >= WATCHING,
    pending: groupPending.has(g.name),
  }))

  const categoryCount = categoryItems.filter((i) => i.subscribed).length
  const tagCount = tagItems.filter((i) => i.subscribed).length
  const groupCount = groupItems.filter((i) => i.subscribed).length

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
            <div className="border-t pt-4 space-y-4">
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
              <Tabs defaultValue="categories">
                <TabsList className="mb-4">
                  <TabsTrigger value="categories">
                    {t('subscriptions.categories')}
                    {categoryCount > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 leading-none">
                        {categoryCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="tags">
                    {t('subscriptions.tags')}
                    {tagCount > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 leading-none">
                        {tagCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="groups">
                    {t('subscriptions.groups')}
                    {groupCount > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 leading-none">
                        {groupCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="categories">
                  <SubscriptionList
                    items={categoryItems}
                    filterKey="cf"
                    onToggle={handleCategoryToggle}
                  />
                </TabsContent>
                <TabsContent value="tags">
                  <SubscriptionList items={tagItems} filterKey="tf" onToggle={handleTagToggle} />
                </TabsContent>
                <TabsContent value="groups">
                  <SubscriptionList items={groupItems} filterKey="gf" onToggle={handleGroupToggle} />
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
