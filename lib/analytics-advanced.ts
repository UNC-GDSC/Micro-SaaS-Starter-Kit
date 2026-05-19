/**
 * Advanced Analytics System
 * - Custom event tracking
 * - Funnel analysis
 * - Cohort analysis
 * - User behavior tracking
 * - Revenue analytics
 */

import { prisma } from './prisma'

export interface AnalyticsEvent {
  event: string
  properties?: Record<string, any>
  userId?: string
  sessionId?: string
  page?: string
  referrer?: string
}

/**
 * Track custom event
 */
export async function trackEvent(params: AnalyticsEvent & {
  userAgent?: string
  ipAddress?: string
  country?: string
  city?: string
}) {
  return await prisma.analyticsEvent.create({
    data: params,
  })
}

/**
 * Track page view
 */
export async function trackPageView(params: {
  userId?: string
  sessionId?: string
  page: string
  referrer?: string
  userAgent?: string
  ipAddress?: string
}) {
  return await trackEvent({
    event: 'page_view',
    ...params,
  })
}

/**
 * Get events by user
 */
export async function getUserEvents(userId: string, limit = 100) {
  return await prisma.analyticsEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Get events by type
 */
export async function getEventsByType(
  event: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: any = { event }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  return await prisma.analyticsEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Count events
 */
export async function countEvents(
  event: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const where: any = { event }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  return await prisma.analyticsEvent.count({ where })
}

/**
 * Funnel analysis
 * Calculate conversion through a series of events
 */
export async function analyzeFunnel(params: {
  events: string[]
  startDate?: Date
  endDate?: Date
}) {
  const { events, startDate, endDate } = params

  const results: Array<{ step: number; event: string; count: number; conversionRate: number; dropOff: number; dropOffRate: number }> = []

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const count = await countEvents(event, startDate, endDate)

    const prevCount = i > 0 ? results[i - 1].count : count
    const conversionRate = prevCount > 0 ? (count / prevCount) * 100 : 0

    results.push({
      step: i + 1,
      event,
      count,
      conversionRate: i === 0 ? 100 : conversionRate,
      dropOff: i === 0 ? 0 : prevCount - count,
      dropOffRate: i === 0 ? 0 : 100 - conversionRate,
    })
  }

  const overallConversion =
    results.length > 0
      ? (results[results.length - 1].count / results[0].count) * 100
      : 0

  return {
    steps: results,
    overallConversion,
    totalUsers: results[0]?.count || 0,
    completedUsers: results[results.length - 1]?.count || 0,
  }
}

/**
 * Cohort analysis
 * Group users by signup date and track retention
 */
export async function analyzeCohort(params: {
  cohortStartDate: Date
  cohortEndDate: Date
  retentionEvent: string
  periodDays?: number
}) {
  const { cohortStartDate, cohortEndDate, retentionEvent, periodDays = 7 } = params

  // Get users who signed up in cohort period
  const cohortUsers = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: cohortStartDate,
        lte: cohortEndDate,
      },
    },
    select: { id: true, createdAt: true },
  })

  const cohortSize = cohortUsers.length
  const retentionPeriods: Array<{
    period: number
    activeUsers: number
    retentionRate: number
  }> = []

  // Calculate retention for each period (0-12 weeks)
  for (let period = 0; period <= 12; period++) {
    const periodStart = new Date(cohortStartDate)
    periodStart.setDate(periodStart.getDate() + period * periodDays)

    const periodEnd = new Date(periodStart)
    periodEnd.setDate(periodEnd.getDate() + periodDays)

    // Count how many cohort users had the retention event in this period
    const activeUserIds = await prisma.analyticsEvent.findMany({
      where: {
        event: retentionEvent,
        userId: { in: cohortUsers.map((u) => u.id) },
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    })

    const activeUsers = activeUserIds.length
    const retentionRate = cohortSize > 0 ? (activeUsers / cohortSize) * 100 : 0

    retentionPeriods.push({
      period,
      activeUsers,
      retentionRate,
    })
  }

  return {
    cohortStartDate,
    cohortEndDate,
    cohortSize,
    retentionEvent,
    periodDays,
    retentionPeriods,
  }
}

/**
 * Get top events
 */
export async function getTopEvents(limit = 10, startDate?: Date, endDate?: Date) {
  const where: any = {}

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const events = await prisma.analyticsEvent.groupBy({
    by: ['event'],
    where,
    _count: { event: true },
    orderBy: { _count: { event: 'desc' } },
    take: limit,
  })

  return events.map((e) => ({
    event: e.event,
    count: e._count.event,
  }))
}

/**
 * Get user journey
 * Track sequence of events for a user
 */
export async function getUserJourney(userId: string, limit = 50) {
  return await prisma.analyticsEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}

/**
 * Calculate LTV (Lifetime Value)
 */
export async function calculateLTV(userId: string): Promise<number> {
  // Get all payments from user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripePriceId: true,
      stripeCurrentPeriodEnd: true,
      createdAt: true,
    },
  })

  if (!user?.stripePriceId) return 0

  // Simple LTV calculation: assume monthly subscription
  // In production, you'd fetch actual payment history from Stripe
  const monthsSinceSignup =
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)

  // Mock price mapping
  const priceMap: Record<string, number> = {
    basic: 990, // $9.90
    pro: 2990, // $29.90
    enterprise: 9990, // $99.90
  }

  const monthlyValue = priceMap[user.stripePriceId] || 0
  const ltv = monthlyValue * monthsSinceSignup

  return Math.round(ltv)
}

/**
 * Get daily active users (DAU)
 */
export async function getDailyActiveUsers(date?: Date): Promise<number> {
  const targetDate = date || new Date()
  const startOfDay = new Date(targetDate)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)

  const activeUsers = await prisma.analyticsEvent.findMany({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: { userId: true },
    distinct: ['userId'],
  })

  return activeUsers.filter((u) => u.userId).length
}

/**
 * Get monthly active users (MAU)
 */
export async function getMonthlyActiveUsers(date?: Date): Promise<number> {
  const targetDate = date || new Date()
  const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
  const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59)

  const activeUsers = await prisma.analyticsEvent.findMany({
    where: {
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    select: { userId: true },
    distinct: ['userId'],
  })

  return activeUsers.filter((u) => u.userId).length
}

/**
 * Calculate revenue forecast
 */
export async function forecastRevenue(months = 12): Promise<
  Array<{
    month: string
    forecast: number
  }>
> {
  // Get current MRR trend
  const activeSubscriptions = await prisma.user.count({
    where: {
      stripeSubscriptionId: { not: null },
    },
  })

  // Mock MRR calculation
  const avgRevenue = 2990 // $29.90 average
  const currentMRR = activeSubscriptions * avgRevenue

  // Simple linear growth model (10% monthly growth)
  const growthRate = 0.1
  const forecast = []

  for (let i = 1; i <= months; i++) {
    const month = new Date()
    month.setMonth(month.getMonth() + i)

    forecast.push({
      month: month.toISOString().slice(0, 7),
      forecast: Math.round(currentMRR * Math.pow(1 + growthRate, i)),
    })
  }

  return forecast
}
