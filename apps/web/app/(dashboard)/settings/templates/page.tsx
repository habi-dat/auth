import { redirect } from 'next/navigation'

/** Redirect old /settings/templates URL to settings page with templates tab. */
export default function SettingsTemplatesPage() {
  redirect('/settings?tab=templates')
}
