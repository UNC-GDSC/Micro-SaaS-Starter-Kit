/**
 * Daily cron: seed interview-rate surveys for users whose firstPaidAt
 * was ~30 days ago and who don't yet have a survey of type "interview_day30".
 *
 * Called from .github/workflows/seed-surveys.yml once per day.
 * Authenticated via Authorization: Bearer <CRON_SECRET>.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { seedDay30Survey } from '@/lib/pmf/survey'

/** Window: users who first paid between 27 and 33 days ago. */
const WINDOW_DAYS_MIN = 27
const WINDOW_DAYS_MAX = 33

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── Find eligible users ─────────────────────────────────────────────────
  const windowStart = daysAgo(WINDOW_DAYS_MAX)
  const windowEnd   = daysAgo(WINDOW_DAYS_MIN)

  const eligibleUsers = await prisma.user.findMany({
    where: {
      firstPaidAt: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true },
  })

  if (eligibleUsers.length === 0) {
    return NextResponse.json({ seeded: 0, message: 'No eligible users in window' })
  }

  // ── Seed surveys (idempotent — seedDay30Survey skips if already exists) ──
  let seeded = 0
  for (const user of eligibleUsers) {
    const created = await seedDay30Survey(user.id)
    if (created) seeded++
  }

  return NextResponse.json({
    seeded,
    eligible: eligibleUsers.length,
    window: { from: windowStart, to: windowEnd },
  })
}

/** Allow GET so you can also ping it from a browser for manual testing. */
export async function GET(req: Request) {
  return POST(req)
}
