export const dynamic = 'force-dynamic'

/**
 * GET /api/improvements  — list pending memory suggestions for the current account
 * POST /api/improvements — apply or dismiss a suggestion
 *   body: { id: string, action: 'apply' | 'dismiss' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccountForUser } from '@/lib/db/accounts'
import { supabaseAdmin } from '@/lib/supabase'
import { createMemory, updateMemory } from '@/lib/db/memories'

async function resolveAccount(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return null
  if ((session as any).isDemo) return null
  return getAccountForUser(session.id)
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await resolveAccount(session)
  if (!account) return NextResponse.json({ suggestions: [] })

  const { data: suggestions, error } = await supabaseAdmin
    .from('improvement_suggestions')
    .select('id, title, description, proposed_change, evidence, confidence_score, evidence_strength, created_at')
    .eq('account_id', account.id)
    .eq('suggestion_type', 'memory')
    .eq('status', 'pending')
    .order('confidence_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ suggestions: suggestions ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await resolveAccount(session)
  if (!account) return NextResponse.json({ error: 'No gym connected' }, { status: 400 })

  const { id, action } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  // Verify the suggestion belongs to this account
  const { data: suggestion } = await supabaseAdmin
    .from('improvement_suggestions')
    .select('*')
    .eq('id', id)
    .eq('account_id', account.id)
    .single()

  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()

  if (action === 'apply') {
    const change = suggestion.proposed_change as any
    if (change.targetMemoryId) {
      // Update existing memory card with the merged content
      await updateMemory(change.targetMemoryId, {
        content: change.content,
        ...(change.importance ? { importance: change.importance } : {}),
      })
    } else {
      await createMemory({
        accountId: account.id,
        content: change.content,
        category: change.category ?? 'preference',
        importance: change.importance ?? 3,
        scope: change.scope ?? 'global',
        source: 'agent',
        ...(change.memberId ? { memberId: change.memberId } : {}),
      })
    }
    await supabaseAdmin
      .from('improvement_suggestions')
      .update({ status: 'auto_applied', applied_at: now, reviewed_at: now })
      .eq('id', id)
  } else if (action === 'dismiss') {
    await supabaseAdmin
      .from('improvement_suggestions')
      .update({ status: 'dismissed', reviewed_at: now })
      .eq('id', id)
  } else {
    return NextResponse.json({ error: 'action must be "apply" or "dismiss"' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
