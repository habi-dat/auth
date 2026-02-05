import nodemailer from 'nodemailer'

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  if (!host || !port) return null
  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  })
}

/** Send an HTML email. No-op if SMTP is not configured. */
export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<{ sent: boolean; error?: string }> {
  const transporter = getTransporter()
  const from = process.env.SMTP_FROM
  if (!transporter || !from) {
    return { sent: false }
  }
  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { sent: false, error: message }
  }
}
