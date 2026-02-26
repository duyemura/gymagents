export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('user_id', session.id)
    .single()

  if (!account) return NextResponse.json({ error: 'Gym not found' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('gym_instagram')
    .delete()
    .eq('account_id', account.id)

  if (error) {
    console.error('Instagram disconnect error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ disconnected: true })
}
