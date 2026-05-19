/**
 * GET /api/unsubscribe?token=<signed_token>
 *
 * One-click, no-login unsubscribe for daily digest emails.
 * The token is HMAC-signed so it cannot be forged (see lib/notifications/unsubscribe-token.ts).
 *
 * On success: redirects to a confirmation page (or returns JSON for API callers).
 * On invalid token: returns 400.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyUnsubscribeToken } from '@/lib/notifications/unsubscribe-token'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const userId = verifyUnsubscribeToken(token)
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or expired unsubscribe token' }, { status: 400 })
  }

  // Idempotent: set dailyDigestEnabled = false
  await prisma.user.update({
    where: { id: userId },
    data: { dailyDigestEnabled: false },
  })

  // Redirect to a friendly confirmation page
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.redirect(`${appUrl}/unsubscribed`, { status: 302 })
}
