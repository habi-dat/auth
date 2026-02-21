import Image from 'next/image'
import { getGeneralSettings } from '@/lib/settings/general'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getGeneralSettings().catch(() => ({
    logoUrl: undefined,
    logoUpdatedAt: undefined,
  }))

  const logoSrc =
    settings.logoUrl && settings.logoUpdatedAt
      ? `${settings.logoUrl}?v=${settings.logoUpdatedAt}`
      : settings.logoUrl

  return (
    <>
      {logoSrc ? (
        <div className="absolute top-6 -left-3 z-10 h-32 w-32 drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)] dark:drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <Image
            src={logoSrc}
            alt=""
            className="h-full w-full object-contain"
            width={128}
            height={128}
          />
        </div>
      ) : null}
      {children}
    </>
  )
}
