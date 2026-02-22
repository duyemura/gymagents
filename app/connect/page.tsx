'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ConnectPage() {
  const [apiKey, setApiKey] = useState('')
  const [companyId, setCompanyId] = useState('')
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
        body: JSON.stringify({ apiKey, companyId })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Connection failed')
      } else {
        setSuccess({ gymName: data.gymName, memberCount: data.memberCount })
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="card p-10 text-center max-w-md w-full">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're connected!</h2>
          <p className="text-gray-600 mb-2">
            <strong>{success.gymName}</strong> is now connected to GymAgents.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            {success.memberCount > 0 ? `${success.memberCount} members found. ` : ''}Your autopilot is ready to run.
          </p>
          <div className="flex items-center justify-center gap-2 text-violet-600">
            <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Taking you to your dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">V</span>
            </div>
            <span className="font-bold text-gray-900 text-xl tracking-tight">GymAgents</span>
          </Link>
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect your gym</h1>
          <p className="text-gray-500 text-sm mb-8">
            GymAgents needs read access to your PushPress data to find at-risk members.
            Your API key is encrypted and stored securely.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PushPress API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk_..."
                className="input font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Find this in PushPress → Settings → API Access
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PushPress Company ID
              </label>
              <input
                type="text"
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                placeholder="4a2fe9b5..."
                className="input font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Find this in PushPress → Settings → Company Info
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Connecting...
                </span>
              ) : 'Connect My Gym →'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 text-sm mb-2">
                Don't have a PushPress account?
              </h3>
              <p className="text-blue-700 text-sm mb-3">
                GymAgents works directly with your PushPress member data. PushPress has a free plan — 
                most gyms and studios get connected in under 20 minutes.
              </p>
              <a
                href="https://www.pushpress.com"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Get your free PushPress account →
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-4">
          Your API key is AES-256 encrypted. We never store it in plaintext.
        </p>
      </div>
    </div>
  )
}
