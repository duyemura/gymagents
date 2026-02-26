export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('user_id', session.id)
    .single()

  if (!account) return NextResponse.json({ connected: false, email: null })

  const { data: gmailRecord } = await supabaseAdmin
    .from('account_gmail')
    .select('gmail_address')
    .eq('account_id', account.id)
    .single()

  return NextResponse.json({
    connected: !!gmailRecord,
    email: gmailRecord?.gmail_address ?? null,
  })
}
