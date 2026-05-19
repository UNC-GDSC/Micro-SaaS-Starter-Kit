// Mock the prisma module before importing quota
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    jobApplication: {
      count: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

// Mock Redis publishEvent so tests don't require a live Redis connection
jest.mock('@/lib/redis', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}))

import { canSendApplication, consumeQuota } from '@/lib/quota'
import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock }
  jobApplication: { count: jest.Mock; updateMany: jest.Mock; findUnique: jest.Mock }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('canSendApplication', () => {
  it('returns false when user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    expect(await canSendApplication('user-missing')).toBe(false)
  })

  it('returns true when under daily limit', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ dailyApplicationLimit: 5, stripePriceId: null })
    mockPrisma.jobApplication.count.mockResolvedValue(3)
    expect(await canSendApplication('user-1')).toBe(true)
  })

  it('returns false when at daily limit', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ dailyApplicationLimit: 5, stripePriceId: null })
    mockPrisma.jobApplication.count.mockResolvedValue(5)
    expect(await canSendApplication('user-1')).toBe(false)
  })

  it('returns false when over daily limit', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ dailyApplicationLimit: 3, stripePriceId: null })
    mockPrisma.jobApplication.count.mockResolvedValue(4)
    expect(await canSendApplication('user-1')).toBe(false)
  })

  it('returns true when limit is 0 and count is 0', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ dailyApplicationLimit: 0, stripePriceId: null })
    mockPrisma.jobApplication.count.mockResolvedValue(0)
    // 0 < 0 is false — quota of 0 means no applications allowed
    expect(await canSendApplication('user-1')).toBe(false)
  })

  it('counts only SUBMITTED, INTERVIEW, OFFER statuses', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ dailyApplicationLimit: 10, stripePriceId: null })
    mockPrisma.jobApplication.count.mockResolvedValue(2)
    await canSendApplication('user-1')
    expect(mockPrisma.jobApplication.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['SUBMITTED', 'INTERVIEW', 'OFFER'] },
        }),
      })
    )
  })
})

describe('consumeQuota', () => {
  it('calls updateMany with null appliedAt filter', async () => {
    mockPrisma.jobApplication.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.jobApplication.findUnique.mockResolvedValue({ jobTitle: 'SWE', company: 'Acme' })
    await consumeQuota('user-1', 'app-1')
    expect(mockPrisma.jobApplication.updateMany).toHaveBeenCalledWith({
      where: { id: 'app-1', userId: 'user-1', appliedAt: null },
      data: expect.objectContaining({ appliedAt: expect.any(Date) }),
    })
  })

  it('does not throw when no rows are updated (already consumed)', async () => {
    mockPrisma.jobApplication.updateMany.mockResolvedValue({ count: 0 })
    await expect(consumeQuota('user-1', 'app-99')).resolves.toBeUndefined()
  })
})
