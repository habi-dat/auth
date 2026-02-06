'use server'

import { InviteEmail } from '@/components/emails/invite-email'
import { PasswordResetEmail } from '@/components/emails/password-reset-email'
import { getDefaultEmailCopy } from '@/lib/email/defaults'
import { updateEmailTemplate } from '@/lib/email/templates'
import type {
  EmailTemplateKey,
  SingleLocaleEmailConfig,
  SupportedEmailLocale,
} from '@/lib/email/types'
import { render } from '@react-email/components'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { adminAction } from './client'

const singleLocaleConfigSchema = z.object({
  subject: z.string().optional(),
  greeting: z.string().optional(),
  mainText: z.string().optional(),
  ctaText: z.string().optional(),
  footer: z.string().optional(),
  footerHelp: z.string().optional(),
  disclaimer: z.string().optional(),
})

const updateSchema = z.object({
  key: z.enum(['invite', 'passwordReset']),
  subject: z.string().min(1).optional(),
  /** Config per locale, e.g. { de: { ... }, en: { ... } } */
  configByLocale: z.record(z.string(), singleLocaleConfigSchema).optional(),
  enabled: z.boolean().optional(),
})

export const updateEmailTemplateAction = adminAction
  .schema(updateSchema)
  .action(async ({ parsedInput }) => {
    const { key, configByLocale, ...data } = parsedInput
    await updateEmailTemplate(key as EmailTemplateKey, {
      subject: data.subject,
      config: configByLocale ?? undefined,
      enabled: data.enabled,
    })
    revalidatePath('/settings/templates')
    return { success: true }
  })

const previewSchema = z.object({
  key: z.enum(['invite', 'passwordReset']),
  locale: z.enum(['de', 'en']),
  /** Config for the preview locale (merged with defaults in action). */
  config: singleLocaleConfigSchema.optional(),
})

const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const platformName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Habidat'

/** Returns HTML for email preview with sample data. Admin only. */
export const getEmailPreviewHtmlAction = adminAction
  .schema(previewSchema)
  .action(async ({ parsedInput }) => {
    const { key, locale, config: configOverride } = parsedInput
    const localeKey = locale as SupportedEmailLocale
    const defaults = getDefaultEmailCopy(localeKey, key)
    const config: SingleLocaleEmailConfig = { ...defaults, ...configOverride }

    if (key === 'invite') {
      const subj = config.subject ?? 'You are invited'
      const html = await render(
        InviteEmail({
          subject: subj,
          inviterName: 'Resi Stanz',
          inviteLink: '#',
          platformName,
          appUrl,
          logoUrl: `${appUrl}/logo.png`,
          greeting: config.greeting,
          mainText: config.mainText,
          ctaText: config.ctaText,
          footer: config.footer,
          footerHelp: config.footerHelp,
          disclaimer: config.disclaimer,
        })
      )
      return { html }
    }

    if (key === 'passwordReset') {
      const subj = config.subject ?? 'Reset your password'
      const html = await render(
        PasswordResetEmail({
          subject: subj,
          resetLink: '#',
          platformName,
          appUrl,
          logoUrl: `${appUrl}/logo.png`,
          greeting: config.greeting,
          mainText: config.mainText,
          ctaText: config.ctaText,
          footer: config.footer,
          footerHelp: config.footerHelp,
          disclaimer: config.disclaimer,
        })
      )
      return { html }
    }

    return { html: '' }
  })
