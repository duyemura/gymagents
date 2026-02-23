import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleInboundReply } from '@/lib/reply-agent'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/webhooks/inbound
 * Dedicated endpoint for Resend inbound email receiving.
 * Configure this URL in Resend → Emails → Receiving → Webhook
 * (separate from the sending webhook)
 *
 * Resend inbound payload structure:
 * {
 *   "type": "email.received",
 *   "data": {
 *     "from": "Dan <dan@pushpress.com>",
 *     "to": ["reply+token@lunovoria.resend.app"],
 *     "subject": "Re: ...",
 *     "text": "actual reply body here",   ← full body
 *     "html": "<html>...</html>",
 *     "email_id": "...",
 *     ...
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Log the full raw payload to DB for debugging
  const rawJson = JSON.stringify(body)
  console.log('inbound webhook received:', rawJson.slice(0, 500))

  const data = body?.data ?? body  // some setups wrap in data, some don't
  const toRaw = data.to ?? data.To ?? ''
  const from = data.from ?? data.From ?? ''
  const text = data.text ?? data.Text ?? data.plain ?? ''
  const html = data.html ?? data.Html ?? ''
  const emailId = data.email_id ?? data.emailId ?? ''
  const subject = data.subject ?? ''

  const toAddress = Array.isArray(toRaw) ? toRaw[0] : toRaw

  // Extract replyToken from reply+{token}@lunovoria.resend.app
  const match = toAddress?.match?.(/reply\+([a-zA-Z0-9_-]+)@/)
  if (!match) {
    console.log('inbound: no reply+ token found in to:', toAddress)
    // Store for debugging
    await supabase.from('agent_conversations').insert({
      action_id: 'debug-inbound',
      gym_id: 'debug',
      role: 'inbound',
      text: `[no-token] from=${from} to=${toAddress} subject=${subject} text_len=${text.length} html_len=${html.length} email_id=${emailId}`,
      member_email: 'debug@debug.com',
      member_name: 'Debug',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  const actionId = match[1]
  const bodyText = text || stripHtml(html)

  if (!bodyText.trim()) {
    console.log(`inbound: empty body for token ${actionId}, email_id=${emailId}`)
    // Store raw for debugging
    await supabase.from('agent_conversations').insert({
      action_id: actionId,
      gym_id: 'demo',
      role: 'inbound',
      text: `[empty-body] email_id=${emailId} raw_keys=${Object.keys(data).join(',')}`,
      member_email: from,
      member_name: 'Unknown',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  const cleanText = stripQuotedReply(bodyText)
  if (!cleanText.trim()) {
    console.log(`inbound: empty after quote-strip for token ${actionId}`)
    return NextResponse.json({ ok: true })
  }

  const nameMatch = from.match(/^(.+?)\s*</)
  const fromName = nameMatch ? nameMatch[1].trim() : from.split('@')[0]
  const fromEmail = from.match(/<(.+?)>/)?.[1] ?? from

  console.log(`inbound: token=${actionId} from=${fromEmail} text="${cleanText.slice(0, 80)}"`)

  try {
    await handleInboundReply({
      actionId,
      memberReply: cleanText.trim(),
      memberEmail: fromEmail,
      memberName: fromName,
    })
    console.log(`inbound: handleInboundReply completed for ${actionId}`)
  } catch (err) {
    console.error(`inbound: handleInboundReply FAILED:`, err)
  }

  return NextResponse.json({ ok: true })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function stripQuotedReply(text: string): string {
  if (!text) return ''
  let t = text.replace(/<[^>]+>/g, ' ')
  const cutPatterns = [
    /\s+On .{5,100}wrote:/,
    /\s+-----Original Message-----/,
    /\s+From:.*@.*\n/,
  ]
  for (const pat of cutPatterns) {
    const match = t.search(pat)
    if (match > 0) { t = t.slice(0, match); break }
  }
  const lines = t.split('\n')
  const cutoff = lines.findIndex(line => /^\s*>/.test(line))
  const clean = cutoff > 0 ? lines.slice(0, cutoff) : lines
  return clean.join('\n').replace(/\s+/g, ' ').trim()
}
