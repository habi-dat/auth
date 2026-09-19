import { createAuth } from '@habidat/auth'
import { prisma } from '@habidat/db'
import { sendEmail } from '@/lib/email/send'
import { renderPasswordResetEmail } from '@/lib/email/templates'
import { hashPasswordSsha } from '@/lib/ldap/password'
import { createSyncEvent, dispatchLdapSyncAfterCommit } from '@/lib/sync/create-sync-event'

async function syncLdapPassword({ userId, password }: { userId: string; password: string }) {
  const hashedPassword = hashPasswordSsha(password)
  const event = await prisma.$transaction((tx) =>
    createSyncEvent(tx, {
      target: 'LDAP',
      operation: 'UPDATE',
      entityType: 'USER',
      entityId: userId,
      payload: { userId, hashedPassword },
    })
  )
  await dispatchLdapSyncAfterCommit(event.id, 'LDAP')
}

export const auth = createAuth({
  sendResetPassword: async ({ user, url }) => {
    void (async () => {
      try {
        const { html, subject } = await renderPasswordResetEmail({ resetLink: url })
        await sendEmail({ to: user.email, subject, html })
      } catch (err) {
        console.error('[Auth] Failed to send password reset email to', user.email, err)
      }
    })()
  },
  syncLdapPassword,
})
