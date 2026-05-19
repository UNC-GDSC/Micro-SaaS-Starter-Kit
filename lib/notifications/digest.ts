/**
 * lib/notifications/digest.ts
 *
 * Generates the daily activity digest for a single user.
 * Returns null when there is nothing to send (empty day, unsubscribed, new user).
 * This is a pure data function — no email sending happens here.
 */

import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DigestApplication {
  id: string
  jobTitle: string
  company: string
  status: string
  appliedAt: Date | null
}

export interface DigestData {
  userId: string
  userName: string | null
  email: string
  applicationsCount: number
  repliesCount: number
  applications: DigestApplication[]
  newReplies: DigestApplication[]
  /** Start of the reporting window (inclusive), midnight UTC */
  periodStart: Date
  /** End of the reporting window (exclusive), midnight UTC of today */
  periodEnd: Date
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current local hour (0-23) for the given IANA timezone.
 * Falls back to UTC on invalid timezone strings.
 */
export function getCurrentHourInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    const raw = formatter.format(new Date())
    // Intl may return "24" for midnight in some locales
    const parsed = parseInt(raw, 10)
    return isNaN(parsed) ? 0 : parsed % 24
  } catch {
    return new Date().getUTCHours()
  }
}

/**
 * Returns the UTC midnight boundaries for "yesterday" relative to now.
 */
export function getYesterdayWindow(): { periodStart: Date; periodEnd: Date } {
  const periodEnd = new Date()
  periodEnd.setUTCHours(0, 0, 0, 0)

  const periodStart = new Date(periodEnd)
  periodStart.setUTCDate(periodStart.getUTCDate() - 1)

  return { periodStart, periodEnd }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generates a digest for the given user ID.
 *
 * Anti-spam rules:
 *   1. User must have `dailyDigestEnabled = true`
 *   2. User must be a paying user (firstPaidAt set)
 *   3. User must have been paying for at least 24 hours (skip day-0)
 *   4. At least one application sent OR one recruiter reply in the window
 *
 * @returns DigestData or null if nothing should be sent
 */
export async function generateDigest(userId: string): Promise<DigestData | null> {
  const { periodStart, periodEnd } = getYesterdayWindow()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      dailyDigestEnabled: true,
      firstPaidAt: true,
    },
  })

  if (!user?.email) return null

  // Rule 1: respect unsubscribe
  if (!user.dailyDigestEnabled) return null

  // Rule 2 & 3: paying users only, with at least 24h since first payment
  if (!user.firstPaidAt) return null
  const msSinceFirstPayment = Date.now() - user.firstPaidAt.getTime()
  if (msSinceFirstPayment < 24 * 60 * 60 * 1000) return null

  // Query yesterday's sent applications (appliedAt in window)
  const applications = await prisma.jobApplication.findMany({
    where: {
      userId,
      appliedAt: { gte: periodStart, lt: periodEnd },
    },
    select: {
      id: true,
      jobTitle: true,
      company: true,
      status: true,
      appliedAt: true,
    },
    orderBy: { appliedAt: 'desc' },
    take: 10, // cap at 10 rows in the email
  })

  // Query recruiter replies: applications where responseAt landed yesterday
  const newReplies = await prisma.jobApplication.findMany({
    where: {
      userId,
      responseAt: { gte: periodStart, lt: periodEnd },
    },
    select: {
      id: true,
      jobTitle: true,
      company: true,
      status: true,
      appliedAt: true,
    },
    orderBy: { responseAt: 'desc' },
    take: 10,
  })

  // Rule 4: skip empty days
  if (applications.length === 0 && newReplies.length === 0) return null

  return {
    userId: user.id,
    userName: user.name,
    email: user.email,
    applicationsCount: applications.length,
    repliesCount: newReplies.length,
    applications,
    newReplies,
    periodStart,
    periodEnd,
  }
}
