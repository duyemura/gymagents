/**
 * lib/db/chat.ts
 *
 * Database helpers for gm_chat_messages table.
 * Unified log for both proactive GM analysis events and reactive owner questions.
 */

import { supabaseAdmin } from '../supabase'
import type { GMChatMessage } from '../gmChat'

// ── appendChatMessage ─────────────────────────────────────────────────────────

export async function appendChatMessage(params: {
  accountId: string
  role: 'user' | 'assistant' | 'system_event'
  content: string
  route?: string
  actionType?: string
  data?: Record<string, unknown>[]
  taskId?: string
  thinkingSteps?: string[]
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('gm_chat_messages')
    .insert({
      account_id: params.accountId,
      role: params.role,
      content: params.content,
      route: params.route ?? null,
      action_type: params.actionType ?? null,
      data: params.data ? JSON.stringify(params.data) : null,
      task_id: params.taskId ?? null,
      thinking_steps: params.thinkingSteps ? JSON.stringify(params.thinkingSteps) : null,
    })

  if (error) {
    console.error('[db/chat] appendChatMessage failed:', error.message)
    // Don't throw — logging failure shouldn't break the response
  }
}

// ── getChatHistory ────────────────────────────────────────────────────────────

export async function getChatHistory(accountId: string, limit = 50): Promise<GMChatMessage[]> {
  const { data, error } = await supabaseAdmin
    .from('gm_chat_messages')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[db/chat] getChatHistory failed:', error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    accountId: row.gym_id,
    role: row.role as GMChatMessage['role'],
    content: row.content,
    route: row.route ?? undefined,
    actionType: row.action_type ?? undefined,
    data: row.data ?? undefined,
    taskId: row.task_id ?? undefined,
    thinkingSteps: row.thinking_steps ?? undefined,
    createdAt: row.created_at,
  }))
}

// ── appendSystemEvent ─────────────────────────────────────────────────────────

export async function appendSystemEvent(accountId: string, content: string): Promise<void> {
  return appendChatMessage({
    accountId,
    role: 'system_event',
    content,
  })
}
