'use client'

import { signOut } from '@habidat/auth/client'
import type { useRouter } from 'next/navigation'
import { getLogoutUrlAction } from '@/lib/actions/auth-actions'

export async function performSignOut(router: ReturnType<typeof useRouter>) {
  const { logoutUrl } = await getLogoutUrlAction()
  if (logoutUrl) {
    router.push(logoutUrl)
    return
  }
  await signOut()
  router.push('/login')
  router.refresh()
}
