'use server'

import { requireUserWithGroups } from '@habidat/auth/session'
import { z } from 'zod'
import { getDiscourseClient } from '../discourse/client'
import { userAction } from './client'

export async function getMailSwitchData() {
  const discourse = getDiscourseClient()
  if (!discourse) return null

  const { user } = await requireUserWithGroups()
  const username = user.username

  const [mailingListOptions, categories, allTags, tagNotifications, groups] = await Promise.all([
    discourse.getUserMailingListOptions(username),
    discourse.getCategoriesWithNotifications(username),
    discourse.getAllTags(),
    discourse.getTagNotifications(username),
    discourse.getGroupsWithNotifications(username),
  ])

  return { ...mailingListOptions, categories, allTags, tagNotifications, groups }
}

export const toggleMailingListModeAction = userAction
  .schema(z.object({ enabled: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const discourse = getDiscourseClient()
    if (!discourse) throw new Error('Discourse not configured')
    const username = ctx.session.user.username
    await discourse.setUserMailingListMode(username, parsedInput.enabled)
    if (parsedInput.enabled) {
      const groups = await discourse.getGroupsWithNotifications(username)
      await Promise.all(groups.map((g) => discourse.setGroupNotificationLevel(username, g.name, 3)))
      return { success: true, subscribedGroups: groups.map((g) => g.name) }
    }
    return { success: true, subscribedGroups: [] }
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
      parsedInput.subscribed ? 3 : 1
    )
    return { success: true }
  })

export const setTagSubscriptionAction = userAction
  .schema(z.object({ tagName: z.string(), subscribed: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const discourse = getDiscourseClient()
    if (!discourse) throw new Error('Discourse not configured')
    await discourse.setTagNotificationLevel(
      ctx.session.user.username,
      parsedInput.tagName,
      parsedInput.subscribed ? 3 : 1
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
      parsedInput.subscribed ? 3 : 1
    )
    return { success: true }
  })
