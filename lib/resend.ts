/**
 * Thin wrapper around Resend email sending.
 * Kept in lib/ so it can be mocked in tests without touching API routes.
 */
import { Resend } from 'resend'

// Lazy singleton — avoids module-level init crashing Next.js build
let _resend: Resend | null = null
const resend = new Proxy({} as Resend, {
  get(_, prop) {
    if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
    return (_resend as any)[prop]
  },
})

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  replyTo?: string
  accountName?: string
  fromName?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id?: string; error?: string }> {
  const from = opts.fromName
    ? `${opts.fromName} <onboarding@resend.dev>`
    : `${opts.accountName ?? 'Your Gym'} <onboarding@resend.dev>`

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.body,
      replyTo: opts.replyTo,
    })
    if (error) return { error: error.message }
    return { id: data?.id }
  } catch (err: any) {
    return { error: err?.message ?? 'Unknown send error' }
  }
}
