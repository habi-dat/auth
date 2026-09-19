import { webEnv } from '@habidat/env/web'
import nodemailer from 'nodemailer'

function getTransporter() {
  return nodemailer.createTransport({
    host: webEnv.SMTP_HOST,
    port: webEnv.SMTP_PORT,
    secure: webEnv.SMTP_SECURE,
    auth:
      webEnv.SMTP_USER && webEnv.SMTP_PASS
        ? { user: webEnv.SMTP_USER, pass: webEnv.SMTP_PASS }
        : undefined,
  })
}

/** Send an HTML email. Throws if SMTP delivery fails. */
export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<{ sent: true }> {
  const transporter = getTransporter()
  try {
    console.log(`Sending email ${params.subject} to ${params.to}`)
    await transporter.sendMail({
      from: webEnv.SMTP_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Failed to send email ${params.subject} to ${params.to}: ${message}`)
    throw new Error(`Failed to send email: ${message}`)
  }
}
