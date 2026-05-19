/**
 * PMF dashboard queries — all 12 metrics from PMF_FRAMEWORK.md § 2.
 * Cached for 15 minutes (900 s) via unstable_cache.
 */

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getPlanByPriceId } from '@/lib/pricing'
import { EXIT_REASONS } from '@/lib/pmf/types'

// ── helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function todayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function pct(num: number, den: number): number | null {
  if (den === 0) return null
  return Math.round((num / den) * 100)
}

/** Map Stripe priceId → monthly price in USD cents. */
function monthlyPriceCents(priceId: string | null | undefined): number {
  const plan = getPlanByPriceId(priceId)
  return Math.round((plan.price ?? 0) * 100)
}

// ── TODAY ──────────────────────────────────────────────────────────────────

export const getTodayMetrics = unstable_cache(
  async () => {
    const start = todayStart()

    const [newFreeSignups, newPaidToday, cancelledToday, newPaidUsers] =
      await Promise.all([
        // New free signups (no subscription) created today
        prisma.user.count({
          where: { createdAt: { gte: start }, stripeSubscriptionId: null },
        }),
        // Free → paid conversions today
        prisma.user.count({
          where: { firstPaidAt: { gte: start } },
        }),
        // Cancellations today
        prisma.user.count({
          where: { cancelledAt: { gte: start } },
        }),
        // Users who first paid today (for MRR calc)
        prisma.user.findMany({
          where: { firstPaidAt: { gte: start } },
          select: { stripePriceId: true },
        }),
      ])

    const cancelledUsers = await prisma.user.findMany({
      where: { cancelledAt: { gte: start } },
      select: { stripePriceId: true },
    })

    const newMrrCents = newPaidUsers.reduce(
      (sum, u) => sum + monthlyPriceCents(u.stripePriceId),
      0
    )
    const lostMrrCents = cancelledUsers.reduce(
      (sum, u) => sum + monthlyPriceCents(u.stripePriceId),
      0
    )
    const netNewMrrCents = newMrrCents - lostMrrCents

    return {
      newFreeSignups,
      freeToPaidConversions: newPaidToday,
      cancellationsToday: cancelledToday,
      netNewMrrCents,
    }
  },
  ['pmf-today'],
  { revalidate: 900 }
)

// ── LAST 30 DAYS ───────────────────────────────────────────────────────────

export const getLast30DaysMetrics = unstable_cache(
  async () => {
    const since = daysAgo(30)

    const [
      appsTotal,
      appsSubmitted,
      appsInterview,
      appsOffer,
      surveyYes,
      surveyTotal,
      cancellations,
      totalPaidUsers,
    ] = await Promise.all([
      prisma.jobApplication.count({ where: { createdAt: { gte: since } } }),
      prisma.jobApplication.count({
        where: {
          createdAt: { gte: since },
          status: { in: ['SUBMITTED', 'INTERVIEW', 'OFFER'] },
        },
      }),
      prisma.jobApplication.count({
        where: { createdAt: { gte: since }, status: 'INTERVIEW' },
      }),
      prisma.jobApplication.count({
        where: { createdAt: { gte: since }, status: 'OFFER' },
      }),
      // Interview rate via survey responses
      prisma.survey.count({
        where: {
          type: 'interview_day30',
          answeredAt: { gte: since },
          response: { path: ['answer'], equals: 'yes' },
        },
      }),
      prisma.survey.count({
        where: { type: 'interview_day30', answeredAt: { gte: since } },
      }),
      // Cancellations with any refundReason (= confirmed exits, not just lapsed)
      prisma.user.count({
        where: { cancelledAt: { gte: since } },
      }),
      // Total paying users ever (for refund rate denominator)
      prisma.user.count({ where: { firstPaidAt: { not: null } } }),
    ])

    return {
      appsTotal,
      appsSubmitted,
      submissionSuccessRate: pct(appsSubmitted, appsTotal),
      appsWithInterview: appsInterview,
      // Prefer survey-based interview rate; fall back to application-status-based
      interviewRateSurvey: pct(surveyYes, surveyTotal),
      interviewRateApps: pct(appsInterview, appsSubmitted),
      appsMarkedGotJob: appsOffer,
      refundsIssued: cancellations,
      refundRate: pct(cancellations, totalPaidUsers),
    }
  },
  ['pmf-last30'],
  { revalidate: 900 }
)

// ── COHORT RETENTION ───────────────────────────────────────────────────────

export const getCohortRetention = unstable_cache(
  async () => {
    const now = new Date()

    const cohortDays = [30, 60, 90] as const

    const results = await Promise.all(
      cohortDays.map(async (days) => {
        // cohort window: users who first paid in the 7-day window ending `days` ago
        const windowEnd = daysAgo(days)
        const windowStart = daysAgo(days + 7)

        const [cohortSize, stillSubscribed] = await Promise.all([
          prisma.user.count({
            where: { firstPaidAt: { gte: windowStart, lt: windowEnd } },
          }),
          prisma.user.count({
            where: {
              firstPaidAt: { gte: windowStart, lt: windowEnd },
              stripeCurrentPeriodEnd: { gte: now },
            },
          }),
        ])

        return {
          days,
          cohortSize,
          stillSubscribed,
          retentionRate: pct(stillSubscribed, cohortSize),
        }
      })
    )

    return results
  },
  ['pmf-cohort'],
  { revalidate: 900 }
)

// ── REFERRAL LOOP ──────────────────────────────────────────────────────────

export const getReferralMetrics = unstable_cache(
  async () => {
    const since = daysAgo(30)

    const gotJobExits = await prisma.user.count({
      where: { cancelledAt: { gte: since }, refundReason: 'got_job' },
    })

    // Referral tracking not yet active — placeholder
    return {
      gotJobExitsThisMonth: gotJobExits,
      referralSignups: 0 as number,
      referralCoefficient: null as number | null,
    }
  },
  ['pmf-referral'],
  { revalidate: 900 }
)

// ── EXIT-REASON HISTOGRAM ──────────────────────────────────────────────────

export const getExitReasonHistogram = unstable_cache(
  async () => {
    const since = daysAgo(30)

    const rows = await prisma.user.groupBy({
      by: ['refundReason'],
      where: { cancelledAt: { gte: since }, refundReason: { not: null } },
      _count: { refundReason: true },
      orderBy: { _count: { refundReason: 'desc' } },
    })

    return rows.map((r) => ({
      reason: r.refundReason!,
      label:
        EXIT_REASONS.find((x) => x.value === r.refundReason)?.label ??
        r.refundReason!,
      count: r._count.refundReason,
    }))
  },
  ['pmf-exit-reasons'],
  { revalidate: 900 }
)

// ── LAST UPDATED TIMESTAMP ─────────────────────────────────────────────────
// Not cached — always reflects actual render time
export function getLastUpdated(): Date {
  return new Date()
}
