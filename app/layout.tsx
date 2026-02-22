import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GymOS — The Operating System for Your Gym',
  description: 'AI-powered autopilot for boutique gyms. GymOS watches your PushPress data, finds at-risk members, drafts re-engagement messages, and works while you teach.',
  keywords: 'gym management, member retention, gym automation, PushPress, CrossFit, yoga studio, BJJ, pilates, spin studio, gym AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
