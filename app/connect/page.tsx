'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ConnectPage() {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ gymName: string; memberCount: number } | null>(null)
  const router = useRouter()

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/gym/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong — please check your API key and try again.')
      } else {
        setSuccess({ gymName: data.gymName, memberCount: data.memberCount })
        setTimeout(() => router.push('/dashboard'), 2500)
      }
    } catch {
      setError('Something went wrong — please try again.')
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 p-10 text-center max-w-md w-full">
          <div className="text-5xl mb-4">🏋️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {success.gymName} is connected!
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {success.memberCount > 0
              ? `${success.memberCount} members loaded. Your agents are ready.`
              : 'Your agents are ready.'}
          </p>
          <div className="flex items-center justify-center gap-2" style={{ color: '#0063FF' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#0063FF' }} />
            <span className="text-sm font-medium">Taking you to your dashboard…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: '#0063FF' }}>
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <span className="font-bold text-gray-900 text-xl">GymAgents</span>
          </Link>
        </div>

        <div className="bg-white border border-gray-200 p-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#080808' }}>Connect your gym</h1>
          <p className="text-gray-500 text-sm mb-8">
            Takes about 2 minutes. Your API key is encrypted and never shared.
          </p>

          {error && (
            <div className="border border-red-100 p-4 mb-6 text-red-600 text-sm" style={{ backgroundColor: '#FEF2F2' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                PushPress API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk_live_..."
                className="w-full px-4 py-3 border border-gray-200 bg-white font-mono text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-blue-400 transition-colors"
                required
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Found in PushPress → Settings → Integrations → API Keys
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold py-4 transition-opacity flex items-center justify-center gap-2 text-base disabled:opacity-50"
              style={{ backgroundColor: '#0063FF' }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            >
              {loading ? (
                <>
                  <span
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                  />
                  Connecting your gym…
                </>
              ) : 'Connect my gym →'}
            </button>
          </form>

          {/* PushPress info */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="p-4" style={{ backgroundColor: 'rgba(0,99,255,0.06)' }}>
              <h3 className="font-semibold text-sm mb-1" style={{ color: '#031A3C' }}>
                Don't have PushPress yet?
              </h3>
              <p className="text-sm mb-3 text-gray-600">
                GymAgents runs on your PushPress data. Free to start — most gyms are live in 20 minutes.
              </p>
              <a
                href="https://www.pushpress.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-white font-semibold px-4 py-2 text-sm transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#0063FF' }}
              >
                Get PushPress free →
              </a>
            </div>
          </div>

          {/* Security note */}
          <p className="text-center text-xs text-gray-400 mt-5">
            🔒 Your API key is AES-256 encrypted and never stored in plain text.
          </p>
        </div>
      </div>
    </div>
  )
}
