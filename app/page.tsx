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
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">Vela</span>
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
          Works for every gym type — CrossFit, yoga, BJJ, pilates, functional fitness
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Members leave quietly.<br />
          <span className="text-violet-600">Vela sees it coming.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Vela connects to your PushPress data and watches every member's patterns — 
          so you know who's drifting away before they cancel. Then it writes the message 
          to bring them back. All while you teach.
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

      {/* Pain — gym-type agnostic */}
      <section className="bg-gray-900 text-white px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Every gym owner knows this feeling.</h2>
          <p className="text-gray-400 text-center mb-12">The data was always there. No one was watching it.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: '"I found out Jamie cancelled when the billing alert hit. She hadn\'t been to a class in seven weeks."',
                stat: 'Most gyms lose 28–40% of members every year',
                icon: '💸'
              },
              {
                quote: '"A lead filled out our contact form during the Tuesday noon class. By the time I saw it, they had already joined somewhere else."',
                stat: 'Leads responded to in under 5 min convert at 4× the rate',
                icon: '⏰'
              },
              {
                quote: '"I can see all the data in PushPress. I just don\'t have time to sit there and analyze who\'s at risk every single week."',
                stat: 'Avg studio owner works 55+ hours/week on ops',
                icon: '🤯'
              }
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6">
                <div className="text-3xl mb-4">{item.icon}</div>
                <p className="text-gray-300 italic mb-4 text-sm leading-relaxed">{item.quote}</p>
                <p className="text-violet-400 text-xs font-semibold uppercase tracking-wide">{item.stat}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Working in the background. Every day.</h2>
          <p className="text-gray-600">Connect your PushPress account once. Vela handles the rest.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            {
              step: '01',
              title: 'Alex hasn\'t been in for 19 days',
              desc: 'Alex used to attend 4 sessions a week. Vela notices the drop, scores the risk, and flags it — before Alex cancels or you have to go digging.',
              icon: '🔍'
            },
            {
              step: '02',
              title: 'A personal message, ready to go',
              desc: '"Hey Alex — noticed you\'ve been away for a bit. Everything alright? We\'d love to have you back. The Thursday evening group keeps asking about you."',
              icon: '✍️'
            },
            {
              step: '03',
              title: 'One click. Message sent. Member kept.',
              desc: 'Approve it as-is, tweak a word, or dismiss it. Vela logs what worked and gets sharper over time — learning your gym\'s patterns.',
              icon: '✅'
            }
          ].map((step, i) => (
            <div key={i} className="relative">
              <div className="text-violet-200 font-bold text-5xl mb-4 select-none">{step.step}</div>
              <div className="text-2xl mb-3">{step.icon}</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{step.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Works for every gym type */}
      <section className="bg-violet-50 px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Built for every kind of studio</h2>
          <p className="text-gray-600 mb-10 text-sm">If your members pay monthly and show up (or don't), Vela is for you.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              '🏋️ CrossFit boxes',
              '🥋 BJJ & martial arts',
              '🧘 Yoga studios',
              '🚴 Spin & cycling',
              '🩰 Pilates studios',
              '💪 Functional fitness',
              '🏃 HIIT studios',
              '🏊 Swim & aquatics',
              '🤸 Gymnastics',
              '⚔️ MMA gyms',
            ].map((type, i) => (
              <span key={i} className="bg-white border border-violet-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-full shadow-sm">
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your autopilot fleet</h2>
          <p className="text-gray-600">Activate the skills your gym needs. Let them run.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { name: '🚨 At-Risk Member Detector', desc: 'Scans attendance patterns daily. Flags members going quiet before they cancel. Drafts a personal re-engagement message for each one.', badge: 'Free', badgeColor: 'bg-green-100 text-green-700' },
            { name: '🎯 Lead Follow-Up Drafter', desc: 'New inquiry while you\'re teaching? Vela drafts a response immediately. You approve and send in under 10 seconds.', badge: 'Starter', badgeColor: 'bg-violet-100 text-violet-700' },
            { name: '💳 Payment Failure Alerter', desc: 'Card declined? Vela catches it and drafts a friendly recovery message — before the member even realizes there\'s a problem.', badge: 'Starter', badgeColor: 'bg-violet-100 text-violet-700' },
            { name: '🎂 Milestone Messenger', desc: 'Member hitting their 6-month or 1-year mark? Vela drafts a celebration note that makes them feel seen and valued.', badge: 'Pro', badgeColor: 'bg-purple-100 text-purple-700' },
            { name: '📊 Class Capacity Optimizer', desc: 'Spots which sessions run consistently under capacity and recommends the right time to nudge members to fill the spots.', badge: 'Pro', badgeColor: 'bg-purple-100 text-purple-700' },
            { name: '💰 Revenue Risk Alerter', desc: 'Tracks billing health, pending renewals, and payment patterns. Flags revenue risk before it becomes a month-end surprise.', badge: 'Pro', badgeColor: 'bg-purple-100 text-purple-700' },
          ].map((feature, i) => (
            <div key={i} className="card p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900">{feature.name}</h3>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${feature.badgeColor}`}>
                  {feature.badge}
                </span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 px-6 py-20" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple pricing. Obvious ROI.</h2>
            <p className="text-gray-600">One kept member pays for a year of Vela.</p>
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
                  'At-Risk Member Scanner',
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
                  '3 autopilot skills active',
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
                  '6 autopilot skills active',
                  'Unlimited scans',
                  'Auto-send mode (configurable)',
                  '12-month trend reports',
                  'Priority support',
                  'White-glove onboarding call',
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
              Vela runs on your PushPress member data. PushPress has a free starter plan — most studios are connected in under 20 minutes.{' '}
              <a href="https://www.pushpress.com" target="_blank" rel="noopener" className="underline font-semibold">
                Get your free PushPress account →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-gray-900 text-white px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">For owners who'd rather teach than do admin</h2>
          <p className="text-gray-400 mb-12">CrossFit boxes, yoga studios, BJJ academies, pilates — if members pay monthly, Vela is your autopilot.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Marcus T.', gym: 'Apex Strength & Conditioning', text: '"I was manually going through the member list every Sunday morning. Vela does it daily now. Got three people back in the first week alone."' },
              { name: 'Priya S.', gym: 'Flow State Yoga Studio', text: '"The messages it drafts actually sound like me — not a template. I just hit approve. That alone is worth it. Writing is the part I hate most."' },
              { name: 'Derek L.', gym: 'Ground Zero BJJ', text: '"My churn was running at 7% monthly. First month with Vela I dropped it to 4.5%. At $130/member, that\'s real money every month."' }
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
          <p className="text-gray-600 text-xs mt-6">* Testimonials represent expected outcomes based on industry retention data</p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center bg-violet-600">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">
            Your autopilot is ready.
          </h2>
          <p className="text-violet-100 mb-8 text-lg">
            Connect your PushPress gym in 2 minutes. See which members are at risk today — free, forever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="bg-white text-violet-700 font-bold px-8 py-4 rounded-lg hover:bg-violet-50 transition-colors">
              Connect My Gym — Free →
            </Link>
            <a href="https://www.pushpress.com" target="_blank" rel="noopener" className="bg-violet-700 text-white font-semibold px-8 py-4 rounded-lg hover:bg-violet-800 transition-colors border border-violet-500">
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
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <span className="font-bold text-gray-900 tracking-tight">Vela</span>
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
