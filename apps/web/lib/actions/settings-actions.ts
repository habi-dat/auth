'use server'

import { updateGeneralSettings } from '@/lib/settings/general'
import { adminAction } from './client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const updateGeneralSchema = z.object({
  platformName: z.string().max(200).optional(),
  logoUrl: z.string().max(500).optional(),
  supportEmail: z.string().email().max(200).optional().or(z.literal('')),
  loginPageText: z.string().max(1000).optional(),
  defaultTheme: z.enum(['1', '2', '3', '4']).optional(),
})

export const updateGeneralSettingsAction = adminAction
  .schema(updateGeneralSchema)
  .action(async ({ parsedInput }) => {
    const data = {
      ...(parsedInput.platformName !== undefined && {
        platformName: parsedInput.platformName || undefined,
      }),
      ...(parsedInput.logoUrl !== undefined && {
        logoUrl: parsedInput.logoUrl || undefined,
      }),
      ...(parsedInput.supportEmail !== undefined && {
        supportEmail: parsedInput.supportEmail || undefined,
      }),
      ...(parsedInput.loginPageText !== undefined && {
        loginPageText: parsedInput.loginPageText || undefined,
      }),
      ...(parsedInput.defaultTheme !== undefined && {
        defaultTheme: parsedInput.defaultTheme,
      }),
    }
    await updateGeneralSettings(data)
    revalidatePath('/settings')
    return { success: true }
  })

/** Remove logo from general settings. Admin only. */
export const removeLogoAction = adminAction
  .schema(z.object({}))
  .action(async () => {
    await updateGeneralSettings({ logoUrl: undefined })
    revalidatePath('/settings')
    revalidatePath('/settings', 'layout')
    revalidatePath('/', 'layout')
    return { success: true }
  })
