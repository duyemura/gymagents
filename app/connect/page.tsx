'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ConnectPage() {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ accountName: string; memberCount: number } | null>(null)
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
        setSuccess({ accountName: data.accountName, memberCount: data.memberCount })
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
            {success.accountName} is connected!
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
          <p className="text-gray-500 text-sm mb-6">
            Takes about 2 minutes. We just need your PushPress API key.
          </p>

          {/* Step-by-step instructions */}
          <div className="mb-6 p-4 border border-blue-100" style={{ backgroundColor: '#F0F6FF', borderRadius: 4 }}>
            <p className="text-xs font-semibold text-gray-700 mb-3">How to find your API key:</p>
            <div className="space-y-2.5">
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ backgroundColor: '#0063FF', borderRadius: 2 }}>1</span>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Log in to <a href="https://manage.pushpress.com" target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: '#0063FF' }}>manage.pushpress.com</a>
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ backgroundColor: '#0063FF', borderRadius: 2 }}>2</span>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Go to <strong>Settings</strong> → <strong>Integrations</strong> → <strong>API Keys</strong>
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ backgroundColor: '#0063FF', borderRadius: 2 }}>3</span>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Click <strong>Create API Key</strong>, name it &ldquo;GymAgents&rdquo;, and copy the key
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ backgroundColor: '#0063FF', borderRadius: 2 }}>4</span>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Paste it below and hit connect — that&apos;s it!
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="border border-red-100 p-4 mb-6 text-red-600 text-sm" style={{ backgroundColor: '#FEF2F2', borderRadius: 2 }}>
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
                placeholder="Paste your API key here"
                className="w-full px-4 py-3 border border-gray-200 bg-white font-mono text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-blue-400 transition-colors"
                required
              />
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

          {/* Security + PushPress info */}
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-center text-xs text-gray-400">
              Your API key is AES-256 encrypted and never stored in plain text.
            </p>
            <div className="text-center">
              <span className="text-xs text-gray-400">Don&apos;t have PushPress? </span>
              <a
                href="https://www.pushpress.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold underline"
                style={{ color: '#0063FF' }}
              >
                Get it free →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
