'use server'

import { requireUserWithGroups } from '@habidat/auth/session'
import {
  DISCOURSE_TAG_NAME,
  type DiscourseCategoryWithNotification,
  type DiscourseGroupBasic,
  type DiscourseTagBasic,
  type DiscourseTagNotification,
  isDiscourseNotFound,
  NOTIFICATION_LEVEL_MUTED,
  NOTIFICATION_LEVEL_WATCHING,
} from '@habidat/discourse'
import { z } from 'zod'
import { getDiscourseClient } from '../discourse/client'
import { userAction } from './client'

/** Subscribed = watching, unsubscribed = muted (mailing list mode skips muted items). */
const subscriptionLevel = (subscribed: boolean) =>
  subscribed ? NOTIFICATION_LEVEL_WATCHING : NOTIFICATION_LEVEL_MUTED

export interface MailSwitchData {
  mailingListMode: boolean
  echoOwnPosts: boolean
  categories: DiscourseCategoryWithNotification[]
  allTags: DiscourseTagBasic[]
  tagNotifications: DiscourseTagNotification[]
  groups: DiscourseGroupBasic[]
}

export type MailSwitchLoadResult =
  | { status: 'unconfigured' }
  | { status: 'missingUser' }
  | { status: 'error' }
  | ({ status: 'ok' } & MailSwitchData)

export async function getMailSwitchData(): Promise<MailSwitchLoadResult> {
  const discourse = getDiscourseClient()
  if (!discourse) return { status: 'unconfigured' }

  const { user } = await requireUserWithGroups()
  const username = user.username

  try {
    const profile = await discourse.getUserMailProfile(username)
    if (!profile) return { status: 'missingUser' }

    const [categories, allTags] = await Promise.all([
      discourse.getCategoriesWithNotifications(username),
      discourse.getAllTags(username),
    ])

    return { status: 'ok', ...profile, categories, allTags }
  } catch (err) {
    if (isDiscourseNotFound(err)) return { status: 'missingUser' }
    console.error('Failed to load mail settings:', err)
    return { status: 'error' }
  }
}

export const toggleMailingListModeAction = userAction
  .schema(z.object({ enabled: z.boolean(), echoOwnPosts: z.boolean().default(true) }))
  .action(async ({ parsedInput, ctx }) => {
    const discourse = getDiscourseClient()
    if (!discourse) throw new Error('Discourse not configured')
    await discourse.setUserMailingListMode(
      ctx.session.user.username,
      parsedInput.enabled,
      parsedInput.echoOwnPosts
    )
    return { success: true }
  })

export const toggleEchoOwnMessagesAction = userAction
  .schema(z.object({ echo: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const discourse = getDiscourseClient()
    if (!discourse) throw new Error('Discourse not configured')
    await discourse.setMailingListEchoOwnPosts(ctx.session.user.username, parsedInput.echo)
    return { success: true }
  })

export const setCategorySubscriptionAction = userAction
  .schema(z.object({ categoryId: z.number(), subscribed: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const discourse = getDiscourseClient()
    if (!discourse) throw new Error('Discourse not configured')
    await discourse.setCategoryNotificationLevel(
      ctx.session.user.username,
      parsedInput.categoryId,
      subscriptionLevel(parsedInput.subscribed)
    )
    return { success: true }
  })

export const setTagSubscriptionAction = userAction
  .schema(z.object({ tagName: z.string().regex(DISCOURSE_TAG_NAME), subscribed: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const discourse = getDiscourseClient()
    if (!discourse) throw new Error('Discourse not configured')
    await discourse.setTagSubscription(
      ctx.session.user.username,
      parsedInput.tagName,
      parsedInput.subscribed
    )
    return { success: true }
  })

export const setGroupSubscriptionAction = userAction
  .schema(z.object({ groupName: z.string(), subscribed: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const discourse = getDiscourseClient()
    if (!discourse) throw new Error('Discourse not configured')
    await discourse.setGroupNotificationLevel(
      ctx.session.user.username,
      parsedInput.groupName,
      subscriptionLevel(parsedInput.subscribed)
    )
    return { success: true }
  })
