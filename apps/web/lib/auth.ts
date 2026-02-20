import { createAuth } from '@habidat/auth'
import { sendEmail } from '@/lib/email/send'
import { renderPasswordResetEmail } from '@/lib/email/templates'

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
})
