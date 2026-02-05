/** Single-locale config for email template text fields. */
export interface SingleLocaleEmailConfig {
  subject?: string
  greeting?: string
  mainText?: string
  ctaText?: string
  footer?: string
  /** Optional help/support paragraph (e.g. link to help, contact email). */
  footerHelp?: string
  /** Optional disclaimer (e.g. "This email was generated via {{appUrl}}"). Supports {{appUrl}} placeholder. */
  disclaimer?: string
}

/** Configurable text fields for the invite email template (flat, one locale). */
export interface InviteEmailConfig extends SingleLocaleEmailConfig {}

/** Configurable text fields for the password reset email template (flat, one locale). */
export interface PasswordResetEmailConfig extends SingleLocaleEmailConfig {}

/**
 * Template config keyed by locale. Admins can set custom texts per language.
 * Example: { de: { greeting: '...', ... }, en: { ... } }
 */
export type EmailTemplateConfigByLocale = Record<string, SingleLocaleEmailConfig>

export type EmailTemplateKey = 'invite' | 'passwordReset'

export type EmailTemplateConfig = InviteEmailConfig | PasswordResetEmailConfig

/** Locales supported for email template custom texts. */
export const SUPPORTED_EMAIL_LOCALES = ['de', 'en'] as const
export type SupportedEmailLocale = (typeof SUPPORTED_EMAIL_LOCALES)[number]
