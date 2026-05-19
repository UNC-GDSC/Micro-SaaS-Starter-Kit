import { prisma } from './prisma'
import { auditDataExport } from './audit'

export async function exportUserData(userId: string) {
  // Get all user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: true,
      apiKeys: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          lastUsed: true,
          expiresAt: true,
        },
      },
      notifications: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Get usage records
  const usageRecords = await prisma.usageRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })

  // Get activity logs
  const activityLogs = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })

  // Audit the export
  await auditDataExport(userId, 'FULL_DATA_EXPORT')

  // Compile data export
  const exportData = {
    exportDate: new Date().toISOString(),
    user,
    usageRecords,
    activityLogs,
  }

  return exportData
}

export async function deleteUserData(userId: string) {
  // This will cascade delete most related records due to onDelete: Cascade
  // But let's be explicit about what we're deleting

  await prisma.$transaction([
    // Delete API keys
    prisma.apiKey.deleteMany({ where: { userId } }),

    // Delete notifications
    prisma.notification.deleteMany({ where: { userId } }),

    // Delete usage records
    prisma.usageRecord.deleteMany({ where: { userId } }),

    // Delete activity logs
    prisma.activityLog.deleteMany({ where: { userId } }),

    // Delete uploads
    prisma.upload.deleteMany({ where: { userId } }),

    // Finally delete the user (this will cascade to accounts, sessions)
    prisma.user.delete({ where: { id: userId } }),
  ])

  return { success: true }
}
