import type { SingleLocaleEmailConfig, SupportedEmailLocale } from '@/lib/email/types'
import { SUPPORTED_EMAIL_LOCALES } from '@/lib/email/types'
import deMessages from '@/messages/de.json'
import enMessages from '@/messages/en.json'

type MessagesShape = {
  emailTemplates?: {
    invite?: Record<string, string>
    passwordReset?: Record<string, string>
  }
}

const messagesByLocale: Record<SupportedEmailLocale, MessagesShape> = {
  de: deMessages as MessagesShape,
  en: enMessages as MessagesShape,
}

/** Default email copy from next-intl messages for a given locale and template. */
export function getDefaultEmailCopy(
  locale: SupportedEmailLocale,
  templateKey: 'invite' | 'passwordReset'
): SingleLocaleEmailConfig {
  const messages = messagesByLocale[locale] ?? messagesByLocale.de
  const templates = messages.emailTemplates?.[templateKey]
  if (!templates || typeof templates !== 'object') {
    return {}
  }
  const t = templates as Record<string, string>
  return {
    subject: t.subject,
    greeting: t.greeting,
    mainText: t.mainText,
    ctaText: t.ctaText,
    footer: t.footer,
    footerHelp: t.footerHelp,
    disclaimer: t.disclaimer,
  }
}

export function getSupportedEmailLocales(): readonly SupportedEmailLocale[] {
  return SUPPORTED_EMAIL_LOCALES
}
