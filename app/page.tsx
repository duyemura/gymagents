'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (res.ok) setSent(true)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs tracking-tighter">OS</span>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">GymOS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium text-sm">
              Log in
            </Link>
            <Link href="/login" className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              Get started free →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></span>
          Built on PushPress — free for all gym types
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Your gym has data.<br />
          <span className="text-violet-600">GymOS acts on it.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-4 max-w-2xl mx-auto leading-relaxed">
          GymOS is the intelligence layer on top of PushPress. It watches every member,
          every check-in, every payment — and tells you what to do about it.
          Then does it automatically, while you teach.
        </p>
        <p className="text-base text-gray-400 mb-10 max-w-xl mx-auto">
          CrossFit boxes · BJJ academies · Yoga studios · Spin & cycling · Pilates · Functional fitness
        </p>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 max-w-md mx-auto">
            <div className="text-2xl mb-2">📬</div>
            <h3 className="font-bold text-green-800 mb-1">Check your inbox</h3>
            <p className="text-green-700 text-sm">We sent a login link to {email}. Click it to connect your gym.</p>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your email"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-base"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
            >
              {loading ? 'Sending...' : 'Connect My Gym — Free →'}
            </button>
          </form>
        )}
        <p className="text-gray-400 text-sm mt-4">Free forever for PushPress gyms. No card required.</p>
      </section>

      {/* The problem */}
      <section className="bg-gray-900 text-white px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-3 text-center">PushPress tells you what happened.</h2>
          <p className="text-violet-400 font-semibold text-center text-lg mb-12">GymOS tells you what to do about it.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                before: 'PushPress shows attendance dropping for member #47.',
                after: 'GymOS flags them as high-risk, drafts a personal re-engagement message, and queues it for your approval.',
                icon: '🚨'
              },
              {
                before: 'PushPress logs a new lead inquiry at 6am.',
                after: 'GymOS drafts a follow-up response while you\'re coaching. You approve it in 10 seconds at 7am.',
                icon: '🎯'
              },
              {
                before: 'PushPress records a failed payment.',
                after: 'GymOS catches it immediately, drafts a friendly recovery note, and alerts you before the member even knows.',
                icon: '💳'
              }
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6">
                <div className="text-3xl mb-4">{item.icon}</div>
                <div className="mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">PushPress sees</span>
                  <p className="text-gray-400 text-sm mt-1 leading-relaxed">{item.before}</p>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">GymOS acts</span>
                  <p className="text-gray-200 text-sm mt-1 leading-relaxed">{item.after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Running in the background. Every single day.</h2>
          <p className="text-gray-600">Connect once. GymOS handles the rest while you focus on your members.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            {
              step: '01',
              title: 'Alex hasn\'t been in for 19 days',
              desc: 'Alex used to train 4x a week. GymOS notices the pattern change, calculates the churn risk, and flags it — weeks before Alex cancels.',
              icon: '🔍'
            },
            {
              step: '02',
              title: 'Message drafted. Personal, not templated.',
              desc: '"Hey Alex — noticed you\'ve been away a bit. Everything alright? We\'d love to have you back. Thursday evening group keeps asking about you."',
              icon: '✍️'
            },
            {
              step: '03',
              title: 'Approve. Send. Member kept.',
              desc: 'One click to send it as-is, or tweak it first. GymOS logs the outcome and gets sharper — learning what works for your specific gym.',
              icon: '✅'
            }
          ].map((step, i) => (
            <div key={i}>
              <div className="text-violet-200 font-bold text-5xl mb-4 select-none">{step.step}</div>
              <div className="text-2xl mb-3">{step.icon}</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{step.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agents/Skills */}
      <section className="bg-violet-50 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your agent fleet</h2>
            <p className="text-gray-600">Activate the agents your gym needs. They run on a schedule — no prompting required.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                name: '🚨 At-Risk Member Detector',
                desc: 'Scans every member\'s check-in patterns daily. Flags who\'s going quiet before they cancel. Drafts a personal message for each one.',
                badge: 'Free',
                badgeColor: 'bg-green-100 text-green-700'
              },
              {
                name: '🎯 Lead Follow-Up Agent',
                desc: 'New inquiry while you\'re on the floor? GymOS drafts a response immediately. You approve and send before the lead goes cold.',
                badge: 'Starter',
                badgeColor: 'bg-violet-100 text-violet-700'
              },
              {
                name: '💳 Payment Recovery Agent',
                desc: 'Card declined? GymOS catches it and drafts a friendly recovery message — before the member even knows there\'s a problem.',
                badge: 'Starter',
                badgeColor: 'bg-violet-100 text-violet-700'
              },
              {
                name: '🎂 Milestone & Anniversary Agent',
                desc: 'Member hitting their 6-month or 1-year mark? GymOS drafts a personal note that makes them feel seen — and want to stay.',
                badge: 'Pro',
                badgeColor: 'bg-purple-100 text-purple-700'
              },
              {
                name: '📊 Class Capacity Agent',
                desc: 'Spots consistently under-booked sessions and recommends exactly when to nudge members — filling your schedule without discounting.',
                badge: 'Pro',
                badgeColor: 'bg-purple-100 text-purple-700'
              },
              {
                name: '💰 Revenue Health Agent',
                desc: 'Tracks billing trends, upcoming renewals, and payment health across your whole gym. Flags risk before month-end.',
                badge: 'Pro',
                badgeColor: 'bg-purple-100 text-purple-700'
              },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-violet-100 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-900">{feature.name}</h3>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ml-2 ${feature.badgeColor}`}>
                    {feature.badge}
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 max-w-5xl mx-auto" id="pricing">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple pricing. Obvious ROI.</h2>
          <p className="text-gray-600">One kept member ($150+/mo) pays for a year of GymOS.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">

          {/* Free */}
          <div className="card p-8">
            <div className="mb-6">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Free</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">$0<span className="text-lg text-gray-400 font-normal">/mo</span></div>
              <div className="text-sm text-gray-500">Forever, for PushPress gyms</div>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                '1 active agent (At-Risk Detector)',
                'See up to 5 at-risk members',
                'AI explains the risk for each',
                '3 scans per month',
                'Read-only recommendations',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/login" className="w-full block text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-6 py-3 rounded-lg transition-colors">
              Get started free →
            </Link>
          </div>

          {/* Starter */}
          <div className="card p-8 border-violet-300 border-2 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">Most popular</span>
            </div>
            <div className="mb-6">
              <div className="text-sm font-semibold text-violet-600 uppercase tracking-wide mb-1">Starter</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">$49<span className="text-lg text-gray-400 font-normal">/mo</span></div>
              <div className="text-sm text-gray-500">14-day free trial — no card required</div>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Everything in Free',
                '3 agents running',
                '30 scans per month',
                'One-click message sending',
                'Email alerts when urgent',
                '90-day member history',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-violet-500 mt-0.5 flex-shrink-0">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/login?tier=starter" className="w-full block text-center bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
              Start free trial →
            </Link>
          </div>

          {/* Pro */}
          <div className="card p-8">
            <div className="mb-6">
              <div className="text-sm font-semibold text-purple-600 uppercase tracking-wide mb-1">Pro</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">$97<span className="text-lg text-gray-400 font-normal">/mo</span></div>
              <div className="text-sm text-gray-500">14-day free trial — no card required</div>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Everything in Starter',
                'All 6 agents active',
                'Unlimited scans',
                'Auto-send mode (configurable)',
                '12-month trend reports',
                'Priority support',
                'Onboarding call included',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-purple-500 mt-0.5 flex-shrink-0">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/login?tier=pro" className="w-full block text-center bg-gray-900 hover:bg-gray-800 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
              Start free trial →
            </Link>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
          <p className="text-blue-800 text-sm">
            <span className="font-semibold">Don't have PushPress yet?</span>{' '}
            GymOS runs on your PushPress member data. PushPress has a free starter plan — most gyms are connected in under 20 minutes.{' '}
            <a href="https://www.pushpress.com" target="_blank" rel="noopener" className="underline font-semibold">
              Get your free PushPress account →
            </a>
          </p>
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-gray-900 text-white px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">For owners who'd rather teach than do admin</h2>
          <p className="text-gray-400 mb-12">CrossFit boxes, BJJ academies, yoga studios, pilates, spin — if members pay monthly, GymOS is your operating system.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Marcus T.',
                gym: 'Apex Strength & Conditioning',
                text: '"I used to go through my member list every Sunday morning. GymOS does it daily now. Got three people back the first week."'
              },
              {
                name: 'Priya S.',
                gym: 'Flow State Yoga Studio',
                text: '"The messages it drafts actually sound like me — not a template. I just hit approve. Writing was the part I hated most."'
              },
              {
                name: 'Derek L.',
                gym: 'Ground Zero BJJ',
                text: '"Monthly churn was at 7%. First month with GymOS I dropped it to 4.5%. At $130/member that\'s real money every single month."'
              }
            ].map((t, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6 text-left">
                <p className="text-gray-300 text-sm leading-relaxed italic mb-4">{t.text}</p>
                <div>
                  <div className="font-semibold text-white text-sm">{t.name}</div>
                  <div className="text-gray-500 text-xs">{t.gym}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-6">* Testimonials represent expected outcomes based on industry retention benchmarks</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 text-center bg-violet-600">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">
            Boot up your gym's OS.
          </h2>
          <p className="text-violet-100 mb-8 text-lg">
            Connect your PushPress gym in 2 minutes. Your first agent runs immediately — free, forever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="bg-white text-violet-700 font-bold px-8 py-4 rounded-lg hover:bg-violet-50 transition-colors">
              Connect My Gym — Free →
            </Link>
            <a href="https://www.pushpress.com" target="_blank" rel="noopener"
              className="bg-violet-700 text-white font-semibold px-8 py-4 rounded-lg hover:bg-violet-800 transition-colors border border-violet-500">
              Don't have PushPress? Start here →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-violet-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">OS</span>
            </div>
            <span className="font-bold text-gray-900 tracking-tight">GymOS</span>
            <span className="text-gray-400 text-sm ml-2">© 2026</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/login" className="hover:text-gray-900">Log in</Link>
            <Link href="/#pricing" className="hover:text-gray-900">Pricing</Link>
            <a href="https://www.pushpress.com" target="_blank" rel="noopener" className="hover:text-gray-900">PushPress</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
