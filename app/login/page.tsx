'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    invalid: 'That login link was invalid. Please request a new one.',
    expired: 'That login link has expired. Please request a new one.',
    notfound: 'Account not found. Please check your email.'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        setSent(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">B</span>
            </div>
            <span className="font-bold text-gray-900 text-xl">BoxAssist</span>
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Your gym's autopilot</p>
        </div>

        <div className="card p-8">
          {errorParam && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-red-700 text-sm">
              {errorMessages[errorParam] || 'Something went wrong. Please try again.'}
            </div>
          )}

          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📬</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-600 text-sm mb-6">
                We sent a login link to <strong>{email}</strong>. 
                Click it to access your gym dashboard.
              </p>
              <p className="text-gray-400 text-xs">Link expires in 15 minutes. Can't find it? Check your spam folder.</p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-4 text-orange-600 hover:text-orange-700 text-sm font-medium"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Log in to BoxAssist</h1>
              <p className="text-gray-500 text-sm mb-6">
                We'll send a magic link to your email — no password needed.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@yourgym.com"
                    className="input"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                  {loading ? 'Sending magic link...' : 'Send my login link →'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <p className="text-gray-500 text-sm">New to BoxAssist?</p>
                <p className="text-gray-600 text-sm mt-1">
                  Just enter your email — we'll create your account automatically.
                </p>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-blue-700 text-xs text-center">
                  BoxAssist connects to your{' '}
                  <a href="https://www.pushpress.com" target="_blank" rel="noopener" className="font-semibold underline">
                    PushPress
                  </a>{' '}
                  account. Don't have PushPress?{' '}
                  <a href="https://www.pushpress.com" target="_blank" rel="noopener" className="font-semibold underline">
                    Start free →
                  </a>
                </p>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-gray-400 text-xs mt-4">
          <Link href="/" className="hover:text-gray-600">← Back to BoxAssist</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  )
}
