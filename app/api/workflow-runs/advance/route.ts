export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { advanceRun } from '@/lib/workflow-runner'

/**
 * POST /api/workflow-runs/advance
 * Called when an owner marks a task done, or to manually advance a run.
 * Body: { runId, nextStep }
 */
export async function POST(req: NextRequest) {
  const { runId, nextStep } = await req.json()
  if (!runId || !nextStep) {
    return NextResponse.json({ error: 'runId and nextStep required' }, { status: 400 })
  }

  const { data: run } = await supabase
    .from('workflow_runs')
    .select('*, workflows(*)')
    .eq('id', runId)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status === 'achieved' || run.status === 'timed_out') {
    return NextResponse.json({ error: `Run is already ${run.status}` }, { status: 400 })
  }

  try {
    await advanceRun(run, nextStep, run.workflows)
    return NextResponse.json({ ok: true, nextStep })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
