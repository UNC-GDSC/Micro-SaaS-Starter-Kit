import { prisma } from './prisma'
import { publishEvent } from './redis'

export async function canSendApplication(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyApplicationLimit: true, stripePriceId: true },
  })
  if (!user) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const count = await prisma.jobApplication.count({
    where: {
      userId,
      appliedAt: { gte: today },
      status: { in: ['SUBMITTED', 'INTERVIEW', 'OFFER'] },
    },
  })

  return count < user.dailyApplicationLimit
}

export async function consumeQuota(userId: string, jobApplicationId: string): Promise<void> {
  const updated = await prisma.jobApplication.updateMany({
    where: { id: jobApplicationId, userId, appliedAt: null },
    data: { appliedAt: new Date() },
  })

  // P18: publish to notifier when an application is officially submitted
  if (updated.count > 0) {
    const app = await prisma.jobApplication.findUnique({
      where: { id: jobApplicationId },
      select: { jobTitle: true, company: true },
    })
    if (app) {
      await publishEvent('application_events', {
        type: 'application_submitted',
        userId,
        applicationId: jobApplicationId,
        jobTitle: app.jobTitle,
        company: app.company,
        timestamp: new Date().toISOString(),
      })
    }
  }
}
