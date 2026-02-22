import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY!)
const JWT_SECRET = process.env.JWT_SECRET!

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    
    const normalizedEmail = email.toLowerCase().trim()
    
    // Create or get user
    let { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single()
    
    if (!user) {
      const { data: newUser, error } = await supabaseAdmin
        .from('users')
        .insert({ email: normalizedEmail })
        .select()
        .single()
      
      if (error || !newUser) {
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
      }
      user = newUser
    }
    
    // Create magic link token (expires in 15 minutes)
    const token = jwt.sign(
      { userId: user.id, email: normalizedEmail, type: 'magic_link' },
      JWT_SECRET,
      { expiresIn: '15m' }
    )
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const magicLink = `${appUrl}/api/auth/verify?token=${token}`
    
    // Send magic link email
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@valuemygym.com',
      to: normalizedEmail,
      subject: 'Your BoxAssist login link',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">
            Your gym assistant is ready 💪
          </h1>
          <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">
            Click the button below to log in to BoxAssist. This link expires in 15 minutes.
          </p>
          <a href="${magicLink}" 
             style="display: inline-block; background: #f97316; color: white; font-weight: 600; 
                    padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px;">
            Log In to BoxAssist →
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 32px;">
            If you didn't request this, you can ignore this email.
          </p>
        </div>
      `
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Magic link error:', error)
    return NextResponse.json({ error: 'Failed to send magic link' }, { status: 500 })
  }
}
