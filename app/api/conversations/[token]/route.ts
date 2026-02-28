import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Never cache — this is a live conversation poll endpoint
export const dynamic = 'force-dynamic'

/**
 * GET /api/conversations/{taskId}
 * Returns the conversation history for a single task.
 * Uses task_conversations (no legacy agent_conversations).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('task_conversations')
    .select('id, role, content, agent_name, evaluation, created_at')
    .eq('task_id', token)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ messages: data ?? [] }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
