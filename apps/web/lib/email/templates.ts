import { InviteEmail } from '@/components/emails/invite-email'
import { PasswordResetEmail } from '@/components/emails/password-reset-email'
import { getDefaultEmailCopy } from '@/lib/email/defaults'
import type {
  EmailTemplateConfigByLocale,
  EmailTemplateKey,
  InviteEmailConfig,
  PasswordResetEmailConfig,
  SingleLocaleEmailConfig,
  SupportedEmailLocale,
} from '@/lib/email/types'
import { getGeneralSettings } from '@/lib/settings/general'
import { prisma } from '@habidat/db'
import { render } from '@react-email/components'

export type { InviteEmailConfig, PasswordResetEmailConfig }

const TEMPLATE_KEYS: EmailTemplateKey[] = ['invite', 'passwordReset']

const defaultLocale: SupportedEmailLocale = 'de'

export function getTemplateKeys(): EmailTemplateKey[] {
  return [...TEMPLATE_KEYS]
}

export async function getEmailTemplate(key: EmailTemplateKey) {
  return prisma.emailTemplate.findUnique({
    where: { key },
  })
}

export async function getEmailTemplates() {
  return prisma.emailTemplate.findMany({
    where: { key: { in: TEMPLATE_KEYS } },
    orderBy: { key: 'asc' },
  })
}

export async function updateEmailTemplate(
  key: EmailTemplateKey,
  data: { subject?: string; config?: object; enabled?: boolean }
) {
  return prisma.emailTemplate.update({
    where: { key },
    data: {
      ...(data.subject != null && { subject: data.subject }),
      ...(data.config != null && { config: data.config as object }),
      ...(data.enabled != null && { enabled: data.enabled }),
    },
  })
}

function mergeLocaleConfig(
  locale: SupportedEmailLocale,
  templateKey: EmailTemplateKey,
  configByLocale: EmailTemplateConfigByLocale | null
): SingleLocaleEmailConfig {
  const defaults = getDefaultEmailCopy(locale, templateKey)
  const raw = configByLocale ?? {}
  const overrides =
    raw[locale] ??
    (locale === 'de' && raw && typeof (raw as SingleLocaleEmailConfig).greeting === 'string'
      ? (raw as SingleLocaleEmailConfig)
      : undefined)
  return {
    ...defaults,
    ...overrides,
  }
}

const appUrlFallback =
  process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function getEmailBranding(): Promise<{
  platformName: string
  appUrl: string
  logoUrl?: string
}> {
  const general = await getGeneralSettings()
  const appUrl = appUrlFallback
  const logoUrlRaw = general.logoUrl?.trim()
  const logoUrl = logoUrlRaw
    ? logoUrlRaw.startsWith('/')
      ? `${appUrl}${logoUrlRaw}`
      : logoUrlRaw
    : `${appUrl}/logo.png`
  return {
    platformName: general.platformName?.trim() || process.env.NEXT_PUBLIC_APP_NAME || 'Habidat',
    appUrl,
    logoUrl,
  }
}

/** Render invite email to HTML. Uses template from DB, merged with default copy for locale. */
export async function renderInviteEmail(params: {
  inviterName: string
  inviteLink: string
  subject?: string
  config?: InviteEmailConfig | null
  locale?: SupportedEmailLocale
}): Promise<{ html: string; subject: string }> {
  const locale = params.locale ?? defaultLocale
  const template = await getEmailTemplate('invite')
  const configByLocale = (template?.config as EmailTemplateConfigByLocale | null) ?? null
  const config = mergeLocaleConfig(locale, 'invite', configByLocale)

  const subject = params.subject ?? config.subject ?? template?.subject ?? 'You are invited'
  const branding = await getEmailBranding()

  const html = await render(
    InviteEmail({
      subject,
      inviterName: params.inviterName,
      inviteLink: params.inviteLink,
      platformName: branding.platformName,
      appUrl: branding.appUrl,
      logoUrl: branding.logoUrl,
      greeting: config.greeting,
      mainText: config.mainText,
      ctaText: config.ctaText,
      footer: config.footer,
      footerHelp: config.footerHelp,
      disclaimer: config.disclaimer,
    })
  )
  return { html, subject }
}

/** Render password reset email to HTML. Uses template from DB, merged with default copy for locale. */
export async function renderPasswordResetEmail(params: {
  resetLink: string
  subject?: string
  config?: PasswordResetEmailConfig | null
  locale?: SupportedEmailLocale
}): Promise<{ html: string; subject: string }> {
  const locale = params.locale ?? defaultLocale
  const template = await getEmailTemplate('passwordReset')
  const configByLocale = (template?.config as EmailTemplateConfigByLocale | null) ?? null
  const config = mergeLocaleConfig(locale, 'passwordReset', configByLocale)

  const subject = params.subject ?? config.subject ?? template?.subject ?? 'Reset your password'
  const branding = await getEmailBranding()

  const html = await render(
    PasswordResetEmail({
      subject,
      resetLink: params.resetLink,
      platformName: branding.platformName,
      appUrl: branding.appUrl,
      logoUrl: branding.logoUrl,
      greeting: config.greeting,
      mainText: config.mainText,
      ctaText: config.ctaText,
      footer: config.footer,
      footerHelp: config.footerHelp,
      disclaimer: config.disclaimer,
    })
  )
  return { html, subject }
}
