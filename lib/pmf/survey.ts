/**
 * Survey helpers: find a pending survey for a user to display as modal.
 */

import { prisma } from '@/lib/prisma'
import { SURVEY_TYPES } from '@/lib/pmf/types'

/**
 * Returns the first pending survey for a user, or null.
 * Pending = scheduledFor <= now, answeredAt is null, and either
 *   (a) shownAt is null (never shown), or
 *   (b) shownAt was set > 24h ago (dismissal re-show window).
 */
export async function getPendingSurvey(userId: string) {
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  return prisma.survey.findFirst({
    where: {
      userId,
      scheduledFor: { lte: now },
      answeredAt: null,
      OR: [
        { shownAt: null },
        { shownAt: { lte: twentyFourHoursAgo } },
      ],
    },
    orderBy: { scheduledFor: 'asc' },
  })
}

/**
 * Seed a day-30 survey for a user if one doesn't already exist.
 * Called by the cron route.
 */
export async function seedDay30Survey(userId: string): Promise<boolean> {
  const existing = await prisma.survey.findFirst({
    where: { userId, type: SURVEY_TYPES.INTERVIEW_DAY30 },
  })
  if (existing) return false

  await prisma.survey.create({
    data: {
      userId,
      type: SURVEY_TYPES.INTERVIEW_DAY30,
      scheduledFor: new Date(),
    },
  })
  return true
}
