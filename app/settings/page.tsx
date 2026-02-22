'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const res = await fetch('/api/dashboard')
    if (res.status === 401) { router.push('/login'); return }
    const d = await res.json()
    setData(d)
    setLoading(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure? This will remove your gym connection and all autopilot data.')) return
    setDisconnecting(true)
    await fetch('/api/gym/disconnect', { method: 'POST' })
    router.push('/connect')
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url } = await res.json()
    if (url) window.location.href = url
    setPortalLoading(false)
  }

  const handleCheckout = async (tier: string) => {
    setCheckoutLoading(tier)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier })
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setCheckoutLoading('')
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const tierLabel = { free: 'Free', starter: 'Starter ($49/mo)', pro: 'Pro ($97/mo)' }
  const monthlyLimit = data?.tier === 'free' ? 3 : data?.tier === 'starter' ? 30 : 9999

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <span className="font-bold text-gray-900">GymAgents</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">← Dashboard</Link>
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 text-sm">Log out</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {/* Account */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Email</span>
              <span className="text-gray-900 font-medium text-sm">{data?.user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Plan</span>
              <span className="text-gray-900 font-medium text-sm">{tierLabel[data?.tier as keyof typeof tierLabel]}</span>
            </div>
            {data?.user?.trial_ends_at && data?.user?.stripe_subscription_status === 'trialing' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">Trial ends</span>
                <span className="text-blue-700 font-medium text-sm">{new Date(data.user.trial_ends_at).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Scans this month</span>
              <span className="text-gray-900 font-medium text-sm">
                {data?.monthlyRunCount || 0} / {data?.tier === 'pro' ? '∞' : monthlyLimit}
              </span>
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4">Billing</h2>
          
          {data?.tier === 'free' ? (
            <div className="space-y-3">
              <p className="text-gray-600 text-sm">You're on the free plan. Upgrade to unlock more autopilots.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleCheckout('starter')}
                  disabled={checkoutLoading === 'starter'}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-60"
                >
                  {checkoutLoading === 'starter' ? 'Loading...' : 'Upgrade to Starter — $49/mo →'}
                </button>
                <button
                  onClick={() => handleCheckout('pro')}
                  disabled={checkoutLoading === 'pro'}
                  className="bg-gray-900 hover:bg-gray-800 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-60"
                >
                  {checkoutLoading === 'pro' ? 'Loading...' : 'Upgrade to Pro — $97/mo →'}
                </button>
              </div>
              <p className="text-gray-400 text-xs">14-day free trial on all paid plans. No card required to start.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-600 text-sm">Manage your subscription, update payment method, or cancel anytime.</p>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="bg-gray-900 hover:bg-gray-800 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {portalLoading ? 'Loading...' : 'Open Billing Portal →'}
              </button>
            </div>
          )}
        </div>

        {/* Gym connection */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4">PushPress Connection</h2>
          {data?.gym ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-green-700 font-medium text-sm">Connected to PushPress</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Gym</span>
                  <span className="font-medium text-gray-900">{data.gym.gym_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Members</span>
                  <span className="font-medium text-gray-900">{data.gym.member_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Connected</span>
                  <span className="font-medium text-gray-900">{new Date(data.gym.connected_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-red-500 hover:text-red-700 text-sm font-medium border border-red-200 hover:border-red-300 px-4 py-2 rounded-lg transition-colors"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect PushPress'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 text-sm mb-3">No gym connected.</p>
              <Link href="/connect" className="bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg text-sm hover:bg-blue-800 transition-colors">
                Connect your PushPress gym →
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
