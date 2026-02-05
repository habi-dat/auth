import { prisma } from '@habidat/db'

export interface GeneralSettings {
  platformName?: string
  logoUrl?: string
  supportEmail?: string
  /** Optional text shown on the login page (e.g. welcome message). */
  loginPageText?: string
  /** ISO date string of Setting.updatedAt; use as cache-buster for logo (e.g. ?v=...) */
  logoUpdatedAt?: string
}

const GENERAL_KEY = 'general'

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const row = await prisma.setting.findUnique({
    where: { key: GENERAL_KEY },
  })
  if (!row?.value || typeof row.value !== 'object') return {}
  const v = row.value as Record<string, unknown>
  const logoUrl = typeof v.logoUrl === 'string' ? v.logoUrl : undefined
  return {
    platformName: typeof v.platformName === 'string' ? v.platformName : undefined,
    logoUrl,
    supportEmail: typeof v.supportEmail === 'string' ? v.supportEmail : undefined,
    loginPageText: typeof v.loginPageText === 'string' ? v.loginPageText : undefined,
    logoUpdatedAt: logoUrl && row.updatedAt ? row.updatedAt.toISOString() : undefined,
  }
}

export async function updateGeneralSettings(data: Partial<GeneralSettings>) {
  const current = await getGeneralSettings()
  const merged = { ...current, ...data }
  const { logoUpdatedAt: _dropped, ...value } = merged
  await prisma.setting.upsert({
    where: { key: GENERAL_KEY },
    create: { key: GENERAL_KEY, value: value as object },
    update: { value: value as object },
  })
}
