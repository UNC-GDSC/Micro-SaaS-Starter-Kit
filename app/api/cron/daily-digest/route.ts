/**
 * POST /api/cron/daily-digest
 *
 * Timezone-aware daily digest dispatcher. Called hourly by GitHub Actions.
 * For each call, the endpoint finds paying users whose local clock is 8am
 * (±30 min tolerance handled by the hourly schedule itself), generates their
 * activity digest for yesterday, and sends the email if there is anything to show.
 *
 * Anti-spam rules are enforced inside generateDigest():
 *   - dailyDigestEnabled must be true
 *   - firstPaidAt must be set and at least 24h ago
 *   - At least one application or recruiter reply in the 24h window
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

// Prevent Next.js from attempting static analysis / pre-rendering of this route
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { render } from '@react-email/render'
import * as React from 'react'
import { prisma } from '@/lib/prisma'
import { generateDigest, getCurrentHourInTimezone } from '@/lib/notifications/digest'
import { sendEmail } from '@/lib/email'
import DailyDigestEmail from '@/lib/notifications/templates/daily-digest'
import { createUnsubscribeToken } from '@/lib/notifications/unsubscribe-token'

// Local hour at which we send the digest
const SEND_HOUR = 8

export async function POST(req: Request) {
  const runAt = new Date().toISOString()
  console.log('[daily-digest] cron fired', { runAt })

  // ── Auth ────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[daily-digest] unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://resumeai-bot.ru'

  // ── Find paying users with digest enabled ───────────────────────────────
  const candidates = await prisma.user.findMany({
    where: {
      firstPaidAt: { not: null },
      dailyDigestEnabled: true,
      email: { not: null },
    },
    select: {
      id: true,
      timezone: true,
    },
  })

  console.log('[daily-digest] candidates found', { count: candidates.length })

  if (candidates.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, message: 'No eligible candidates' })
  }

  // ── Filter to users whose local hour is SEND_HOUR ───────────────────────
  const toSend = candidates.filter(
    (u) => getCurrentHourInTimezone(u.timezone) === SEND_HOUR
  )

  console.log('[daily-digest] users at send hour', { sendHour: SEND_HOUR, count: toSend.length })

  if (toSend.length === 0) {
    return NextResponse.json({
      sent: 0,
      skipped: candidates.length,
      message: `No users at hour ${SEND_HOUR} right now`,
    })
  }

  // ── Generate and send digests ────────────────────────────────────────────
  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const user of toSend) {
    try {
      const digest = await generateDigest(user.id)
      if (!digest) {
        console.log('[daily-digest] skip (empty or ineligible)', { userId: user.id })
        skipped++
        continue
      }

      const unsubscribeToken = createUnsubscribeToken(user.id)
      const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
      const dashboardUrl = `${appUrl}/dashboard`

      const html = await render(
        React.createElement(DailyDigestEmail, {
          userName: digest.userName,
          applicationsCount: digest.applicationsCount,
          repliesCount: digest.repliesCount,
          applications: digest.applications,
          newReplies: digest.newReplies,
          periodStart: digest.periodStart,
          unsubscribeUrl,
          dashboardUrl,
        })
      )

      const dateLabel = digest.periodStart.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })

      const result = await sendEmail({
        to: digest.email,
        subject: `Your job-search update for ${dateLabel}`,
        html,
      })

      if (result.success) {
        console.log('[daily-digest] sent', {
          userId: user.id,
          apps: digest.applicationsCount,
          replies: digest.repliesCount,
        })
        sent++
      } else {
        console.error('[daily-digest] send failed', { userId: user.id, error: result.error })
        errors.push(`${user.id}: email send failed`)
        skipped++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[daily-digest] unexpected error', { userId: user.id, error: msg })
      errors.push(`${user.id}: ${msg}`)
      skipped++
    }
  }

  const summary = { sent, skipped, candidates: candidates.length, atSendHour: toSend.length }
  console.log('[daily-digest] complete', summary)

  return NextResponse.json({
    ...summary,
    ...(errors.length > 0 ? { errors } : {}),
  })
}

// Allow GET for manual browser testing
export async function GET(req: Request) {
  return POST(req)
}
