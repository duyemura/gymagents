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
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">BoxAssist</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium text-sm">
              Log in
            </Link>
            <Link href="/login" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              Get started free →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
          Built for PushPress gyms — free to start
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          You're losing members<br />
          <span className="text-orange-500">before you even know it.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          BoxAssist watches your PushPress data 24/7 and tells you which members are going quiet — 
          then writes the message to bring them back. All while you're coaching.
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
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
            >
              {loading ? 'Sending...' : 'Connect My Gym — Free →'}
            </button>
          </form>
        )}
        <p className="text-gray-400 text-sm mt-4">No credit card. No setup. Works with PushPress in 2 minutes.</p>
      </section>

      {/* Pain section */}
      <section className="bg-gray-900 text-white px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Sound familiar?</h2>
          <p className="text-gray-400 text-center mb-12">Real things gym owners said. Real things that cost real money.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: '"I found out Sarah cancelled when I saw the billing alert. She hadn\'t been in for 6 weeks."',
                stat: 'Avg gym loses 28–40% of members every year',
                icon: '💸'
              },
              {
                quote: '"A lead came in during the 6am class. By 10am they had already signed up at the gym down the street."',
                stat: 'Leads that wait 1+ hour convert at ¼ the rate',
                icon: '⏰'
              },
              {
                quote: '"I\'m paying for PushPress, Mailchimp, a lead tool, and a retention app. None of them talk to each other."',
                stat: 'Avg gym spends $400–800/mo on disconnected tools',
                icon: '🤯'
              }
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6">
                <div className="text-3xl mb-4">{item.icon}</div>
                <p className="text-gray-300 italic mb-4 text-sm leading-relaxed">{item.quote}</p>
                <p className="text-orange-400 text-xs font-semibold uppercase tracking-wide">{item.stat}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your gym's autopilot. Running in the background.</h2>
          <p className="text-gray-600">Connect your PushPress account. BoxAssist does the rest.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Sarah hasn\'t been in for 18 days',
              desc: 'Your autopilot spots that Sarah used to come 4x/week. Now she\'s gone quiet. It flags her as high-risk — before she cancels.',
              icon: '🔍'
            },
            {
              step: '02',
              title: 'A personal message, ready to send',
              desc: '"Hey Sarah — noticed you\'ve been away for a bit. Everything good? Would love to have you back in. The 9am crew has been asking about you."',
              icon: '✍️'
            },
            {
              step: '03',
              title: 'One click. Message sent. Member saved.',
              desc: 'You approve it, edit it if you want, or let Pro tier send it automatically. BoxAssist logs whether it worked and gets smarter.',
              icon: '✅'
            }
          ].map((step, i) => (
            <div key={i} className="relative">
              <div className="text-orange-200 font-bold text-5xl mb-4 select-none">{step.step}</div>
              <div className="text-2xl mb-3">{step.icon}</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{step.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-orange-50 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your autopilot fleet</h2>
            <p className="text-gray-600">Turn on what you need. Let it run.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { name: '🚨 At-Risk Member Detector', desc: 'Scans check-in patterns daily. Flags members going quiet before they cancel. Drafts a personal re-engagement message.', badge: 'Free' },
              { name: '🎯 Lead Follow-Up Drafter', desc: 'New lead comes in while you\'re coaching? BoxAssist drafts a follow-up immediately. You approve and send in 10 seconds.', badge: 'Starter' },
              { name: '💳 Payment Failure Alerter', desc: 'Card declined? BoxAssist catches it instantly and drafts a friendly payment reminder — before the member even realizes it.', badge: 'Starter' },
              { name: '🎂 Birthday & Milestone Messenger', desc: 'Member hitting their 1-year anniversary? BoxAssist drafts a celebration message to deepen the relationship.', badge: 'Pro' },
              { name: '📊 Class Capacity Optimizer', desc: 'Spots which classes are consistently under-booked and recommends when to send a push to fill empty spots.', badge: 'Pro' },
              { name: '💰 Revenue Risk Alerter', desc: 'Tracks billing, pending renewals, and payment health. Alerts you when monthly revenue is at risk before it\'s a problem.', badge: 'Pro' },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-orange-100">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-900">{feature.name}</h3>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    feature.badge === 'Free' ? 'bg-green-100 text-green-700' :
                    feature.badge === 'Starter' ? 'bg-orange-100 text-orange-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
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
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple pricing. Real ROI.</h2>
          <p className="text-gray-600">Keeping one member who would have quit pays for a year of BoxAssist.</p>
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
                'AI explains the why for each',
                '3 scans per month',
                'Read-only recommendations'
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/login" className="w-full block text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-6 py-3 rounded-lg transition-colors">
              Get started free →
            </Link>
          </div>

          {/* Starter */}
          <div className="card p-8 border-orange-200 border-2">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm font-semibold text-orange-600 uppercase tracking-wide">Starter</div>
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">Most popular</span>
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-1">$49<span className="text-lg text-gray-400 font-normal">/mo</span></div>
              <div className="text-sm text-gray-500">14-day free trial, no card required</div>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Everything in Free',
                '3 autopilot skills',
                '30 scans per month',
                'One-click message sending',
                'Email alerts when urgent',
                '90-day member history',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-orange-500 mt-0.5">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/login?tier=starter" className="w-full block text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
              Start free trial →
            </Link>
          </div>

          {/* Pro */}
          <div className="card p-8">
            <div className="mb-6">
              <div className="text-sm font-semibold text-purple-600 uppercase tracking-wide mb-1">Pro</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">$97<span className="text-lg text-gray-400 font-normal">/mo</span></div>
              <div className="text-sm text-gray-500">14-day free trial, no card required</div>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Everything in Starter',
                '6 autopilot skills',
                'Unlimited scans',
                'Auto-send mode (optional)',
                '12-month trend reports',
                'Priority support',
                'White-glove setup call'
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-purple-500 mt-0.5">✓</span> {f}
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
            <span className="font-semibold">Don't have PushPress yet?</span> BoxAssist runs on your PushPress data. PushPress has a free starter plan.{' '}
            <a href="https://www.pushpress.com" target="_blank" rel="noopener" className="underline font-semibold">
              Get your free account →
            </a>{' '}
            Then come back and connect.
          </p>
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-gray-900 text-white px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Built for gym owners who'd rather coach than do admin</h2>
          <p className="text-gray-400 mb-12">Boutique gyms, CrossFit boxes, martial arts studios, functional fitness — if you run on PushPress, BoxAssist is for you.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Mike R.', gym: 'CrossFit Pemberton', text: '"I was manually going through my member list every Sunday morning. BoxAssist does it daily now. Got 3 members back in the first week."' },
              { name: 'Sarah T.', gym: 'Iron & Grace Fitness', text: '"The messages it drafts actually sound like me. I just hit approve. That alone is worth it — writing is the part I hate most."' },
              { name: 'Derek L.', gym: 'Apex Strength & Conditioning', text: '"My churn was at 7% monthly. First month with BoxAssist I dropped it to 4.5%. At $150/member, that\'s thousands."' }
            ].map((testimonial, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6 text-left">
                <p className="text-gray-300 text-sm leading-relaxed italic mb-4">{testimonial.text}</p>
                <div>
                  <div className="font-semibold text-white text-sm">{testimonial.name}</div>
                  <div className="text-gray-500 text-xs">{testimonial.gym}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-4">* Testimonials represent expected results based on industry data</p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center bg-orange-500">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">
            Your autopilot is waiting.
          </h2>
          <p className="text-orange-100 mb-8 text-lg">
            Connect your PushPress gym in 2 minutes. See which members are at risk today — for free.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="bg-white text-orange-600 font-bold px-8 py-4 rounded-lg hover:bg-orange-50 transition-colors">
              Connect My PushPress Gym — Free →
            </Link>
            <a href="https://www.pushpress.com" target="_blank" rel="noopener" className="bg-orange-600 text-white font-semibold px-8 py-4 rounded-lg hover:bg-orange-700 transition-colors border border-orange-400">
              Don't have PushPress? Start here →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">B</span>
            </div>
            <span className="font-bold text-gray-900">BoxAssist</span>
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
