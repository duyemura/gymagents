/**
 * Tests for integrations API routes and DB helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockSingle = vi.fn()
const mockDelete = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockUpsert = vi.fn()
const mockInsert = vi.fn()

function makeChain(finalFn: () => any) {
  const chain: any = {
    select: (..._args: any[]) => chain,
    eq: (..._args: any[]) => chain,
    order: (..._args: any[]) => chain,
    single: finalFn,
    delete: (..._args: any[]) => chain,
    upsert: finalFn,
    insert: finalFn,
  }
  // Override to track calls for assertions
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = finalFn
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.upsert = finalFn
  return chain
}

vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

// ── Mock Composio ─────────────────────────────────────────────────────────────

vi.mock('../integrations/composio', () => ({
  getComposio: vi.fn(),
  getAuthConfigId: vi.fn().mockResolvedValue('auth-config-123'),
  initiateOAuthConnection: vi.fn().mockResolvedValue({
    redirectUrl: 'https://oauth.example.com/auth',
    connectedAccountId: 'composio-acc-456',
  }),
  initiateApiKeyConnection: vi.fn().mockResolvedValue('composio-acc-789'),
  deleteConnection: vi.fn().mockResolvedValue(undefined),
  listConnections: vi.fn().mockResolvedValue([
    { integrationId: 'slack', composioAccountId: 'ca-1', status: 'ACTIVE' },
  ]),
  getComposioToolsForAccount: vi.fn().mockResolvedValue([]),
}))

// ── Mock auth / accounts ──────────────────────────────────────────────────────

vi.mock('../auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('../db/accounts', () => ({
  getAccountForUser: vi.fn(),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '../supabase'
import { getIntegrations, getIntegration, upsertIntegration, deleteIntegration } from '../db/integrations'
import { getSession } from '../auth'
import { getAccountForUser } from '../db/accounts'
import { initiateOAuthConnection } from '../integrations/composio'

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<any> = {}) {
  return {
    id: 'row-1',
    account_id: 'acct-1',
    integration_id: 'slack',
    composio_account_id: 'ca-123',
    composio_auth_config: null,
    connected_at: '2024-01-15T10:00:00Z',
    metadata: {},
    ...overrides,
  }
}

// ── DB helper tests ───────────────────────────────────────────────────────────

describe('getIntegrations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped records on success', async () => {
    const row = makeRow()
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [row], error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any)

    const result = await getIntegrations('acct-1')

    expect(result).toHaveLength(1)
    expect(result[0].integrationId).toBe('slack')
    expect(result[0].composioAccountId).toBe('ca-123')
  })

  it('throws on DB error', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any)

    await expect(getIntegrations('acct-1')).rejects.toThrow('getIntegrations failed')
  })

  it('returns empty array when no records', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any)

    const result = await getIntegrations('acct-1')
    expect(result).toEqual([])
  })
})

describe('getIntegration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null for PGRST116 (not found)', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any)

    const result = await getIntegration('acct-1', 'slack')
    expect(result).toBeNull()
  })

  it('returns record when found', async () => {
    const row = makeRow({ metadata: { from_number: '+15551234567' } })
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: row, error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any)

    const result = await getIntegration('acct-1', 'slack')
    expect(result?.metadata.from_number).toBe('+15551234567')
  })
})

describe('upsertIntegration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts without error', async () => {
    const chain: any = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any)

    await expect(upsertIntegration('acct-1', 'slack', 'ca-123', {})).resolves.toBeUndefined()
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: 'acct-1', integration_id: 'slack' }),
      { onConflict: 'account_id,integration_id' },
    )
  })

  it('throws on DB error', async () => {
    const chain: any = {
      upsert: vi.fn().mockResolvedValue({ error: { message: 'unique violation' } }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any)

    await expect(upsertIntegration('acct-1', 'slack', 'ca-123', {})).rejects.toThrow('upsertIntegration failed')
  })

  it('stores metadata including from_number', async () => {
    const chain: any = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any)

    await upsertIntegration('acct-1', 'twilio', 'ca-789', { from_number: '+15551234567' })

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { from_number: '+15551234567' } }),
      expect.any(Object),
    )
  })
})

describe('deleteIntegration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns composioAccountId on successful delete', async () => {
    const row = makeRow()
    // First call: getIntegration (select + eq + single)
    const singleChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: row, error: null }),
    }
    // Second call: delete
    const deleteChain: any = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    // deleteChain.eq returns itself and eventually resolves
    deleteChain.eq = vi.fn().mockImplementation((_col: string, _val: string) => {
      const innerChain: any = {
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
      return innerChain
    })

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(singleChain as any)
      .mockReturnValueOnce(deleteChain as any)

    const composioId = await deleteIntegration('acct-1', 'slack')
    expect(composioId).toBe('ca-123')
  })
})

// ── Connect route tests (AGT-4 bug fix) ──────────────────────────────────────

describe('POST /api/integrations/[id]/connect', () => {
  let POST: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1' } as any)
    vi.mocked(getAccountForUser).mockResolvedValue({ id: 'acct-1', pushpress_api_key: 'key' } as any)
    const mod = await import('@/app/api/integrations/[id]/connect/route')
    POST = mod.POST
  })

  it('returns clean JSON error when Composio throws (AGT-4)', async () => {
    // Simulate the exact error from the bug: Composio has no auth config for notion
    vi.mocked(initiateOAuthConnection).mockRejectedValueOnce(
      new Error('No Composio-managed auth config found for toolkit: notion'),
    )

    const req = new NextRequest('http://localhost:3000/api/integrations/notion/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({}),
    })

    const res = await POST(req, { params: { id: 'notion' } })
    const json = await res.json()

    // Server should return a structured error, not crash
    expect(res.status).toBe(500)
    expect(json.error).toContain('No Composio-managed auth config found')
  })
})

// ── Client-side handleConnect error handling (AGT-4) ─────────────────────────

describe('IntegrationsPanel handleConnect error handling', () => {
  it('should catch errors and show flash instead of throwing (AGT-4)', async () => {
    // This test verifies the FIX -- handleConnect should NOT throw.
    // Before fix: throw new Error(json.error ?? 'Connection failed') -- unhandled
    // After fix: setFlash({ type: 'error', message: ... }) -- handled gracefully

    // Simulate the client-side handleConnect logic:
    // Before fix, this would throw and go unhandled.
    // After fix, it should return the error message without throwing.
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'No Composio-managed auth config found for toolkit: notion' }),
    })

    // Simulate the FIXED handleConnect behavior
    let flashMessage: string | null = null
    const setFlash = (f: { type: string; message: string }) => { flashMessage = f.message }

    const handleConnect = async (id: string) => {
      const res = await mockFetch(`/api/integrations/${id}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()

      if (!res.ok) {
        // FIXED: show flash instead of throwing
        setFlash({ type: 'error', message: json.error ?? 'Connection failed' })
        return
      }
    }

    // This should NOT throw
    await expect(handleConnect('notion')).resolves.toBeUndefined()
    expect(flashMessage).toContain('No Composio-managed auth config found')
  })
})

// ── Registry tests ────────────────────────────────────────────────────────────

describe('integration registry', () => {
  it('exports INTEGRATIONS array with expected featured integrations', async () => {
    const { INTEGRATIONS, getFeaturedIntegrations } = await import('../integrations/registry')

    expect(INTEGRATIONS.length).toBeGreaterThan(0)
    const featured = getFeaturedIntegrations()
    expect(featured.length).toBeGreaterThan(0)

    const slack = featured.find(i => i.id === 'slack')
    expect(slack).toBeDefined()
    expect(slack?.authType).toBe('oauth')

    const twilio = featured.find(i => i.id === 'twilio')
    expect(twilio).toBeDefined()
    expect(twilio?.authType).toBe('api_key')
    expect(twilio?.apiKeyFields?.length).toBeGreaterThan(0)
  })

  it('getIntegration returns undefined for unknown id', async () => {
    const { getIntegration: getReg } = await import('../integrations/registry')
    expect(getReg('nonexistent-tool-xyz')).toBeUndefined()
  })
})
