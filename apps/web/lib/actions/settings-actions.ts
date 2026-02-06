'use server'

import { adminAction } from '@/lib/actions/client'
import { createAuditLog } from '@/lib/audit'
import { getGeneralSettings, updateGeneralSettings } from '@/lib/settings/general'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const updateGeneralSettingsSchema = z.object({
  platformName: z.string().optional(),
  supportEmail: z.string().email().optional(),
  loginPageText: z.string().optional(),
  defaultTheme: z.enum(['1', '2', '3', '4']).optional(), // Kept for backward compat/schema but we will use themeColor
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
})

export const updateGeneralSettingsAction = adminAction
  .schema(updateGeneralSettingsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session } = ctx
    const { defaultTheme: _dt, ...data } = parsedInput

    // We ignore defaultTheme input and use themeColor
    const oldSettings = await getGeneralSettings()
    await updateGeneralSettings(data)

    // Convert old settings roughly for audit log
    const oldValue = {
      ...oldSettings,
    }
    const newValue = {
      ...oldSettings,
      ...data,
    }

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE',
      entityType: 'SETTING',
      entityId: 'general',
      oldValue,
      newValue,
      entityName: 'General Settings',
    })

    revalidatePath('/')
    return { success: true }
  })

export const removeLogoAction = adminAction.action(async ({ ctx }) => {
  const { session } = ctx
  const oldSettings = await getGeneralSettings()
  await updateGeneralSettings({ logoUrl: undefined })

  await createAuditLog({
    actorId: session.user.id,
    action: 'DELETE',
    entityType: 'SETTING',
    entityId: 'general',
    oldValue: { logoUrl: oldSettings.logoUrl },
    entityName: 'General Settings (Logo)',
  })

  revalidatePath('/')
  return { success: true }
})
