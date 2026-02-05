import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/session'

export default async function SettingsPage() {
  await requireAdmin()
  redirect('/settings/templates')
}
