/**
 * Unit tests for PMF cohort-retention query logic.
 * Prisma is mocked; we test the percentage arithmetic and edge cases.
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    jobApplication: {
      count: jest.fn(),
    },
    survey: {
      count: jest.fn(),
    },
  },
}))

// unstable_cache passthrough — run functions directly in tests
jest.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: jest.fn(),
}))

import { getCohortRetention, getLast30DaysMetrics } from '@/lib/pmf/queries'
import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as unknown as {
  user: {
    count: jest.Mock
    findMany: jest.Mock
    groupBy: jest.Mock
  }
  jobApplication: { count: jest.Mock }
  survey: { count: jest.Mock }
}

beforeEach(() => jest.clearAllMocks())

// ── getCohortRetention ─────────────────────────────────────────────────────

describe('getCohortRetention', () => {
  it('returns correct retention % when cohort exists', async () => {
    // D30 cohort: 10 users joined, 8 still subscribed → 80%
    // D60 cohort: 5 users joined, 3 still subscribed → 60%
    // D90 cohort: 4 users joined, 1 still subscribed → 25%
    let callIndex = 0
    mockPrisma.user.count.mockImplementation(() => {
      // called in pairs: cohortSize, stillSubscribed for each of [30, 60, 90]
      const values = [10, 8, 5, 3, 4, 1]
      return Promise.resolve(values[callIndex++])
    })

    const result = await getCohortRetention()

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ days: 30, cohortSize: 10, stillSubscribed: 8, retentionRate: 80 })
    expect(result[1]).toMatchObject({ days: 60, cohortSize: 5,  stillSubscribed: 3, retentionRate: 60 })
    expect(result[2]).toMatchObject({ days: 90, cohortSize: 4,  stillSubscribed: 1, retentionRate: 25 })
  })

  it('returns null retentionRate when cohort is empty (no data yet)', async () => {
    mockPrisma.user.count.mockResolvedValue(0)

    const result = await getCohortRetention()

    for (const row of result) {
      expect(row.cohortSize).toBe(0)
      expect(row.retentionRate).toBeNull()
    }
  })

  it('rounds retention % correctly', async () => {
    // 1 of 3 → 33.33% → rounds to 33
    let callIndex = 0
    mockPrisma.user.count.mockImplementation(() => {
      const values = [3, 1, 0, 0, 0, 0]
      return Promise.resolve(values[callIndex++])
    })

    const result = await getCohortRetention()
    expect(result[0].retentionRate).toBe(33)
  })

  it('handles 100% retention', async () => {
    let callIndex = 0
    mockPrisma.user.count.mockImplementation(() => {
      const values = [5, 5, 0, 0, 0, 0]
      return Promise.resolve(values[callIndex++])
    })

    const result = await getCohortRetention()
    expect(result[0].retentionRate).toBe(100)
  })
})

// ── getLast30DaysMetrics ───────────────────────────────────────────────────

describe('getLast30DaysMetrics', () => {
  function setupMocks({
    appsTotal = 0,
    appsSubmitted = 0,
    appsInterview = 0,
    appsOffer = 0,
    surveyYes = 0,
    surveyTotal = 0,
    cancellations = 0,
    totalPaidUsers = 0,
  } = {}) {
    const counts = [appsTotal, appsSubmitted, appsInterview, appsOffer,
                    surveyYes, surveyTotal, cancellations, totalPaidUsers]
    let i = 0
    mockPrisma.jobApplication.count.mockImplementation(() => {
      if (i < 4) return Promise.resolve(counts[i++])
      return Promise.resolve(0)
    })
    mockPrisma.survey.count.mockImplementation(() => {
      if (i >= 4 && i < 6) return Promise.resolve(counts[i++])
      return Promise.resolve(0)
    })
    mockPrisma.user.count.mockImplementation(() => {
      if (i >= 6 && i < 8) return Promise.resolve(counts[i++])
      return Promise.resolve(0)
    })
  }

  it('calculates submission success rate', async () => {
    mockPrisma.jobApplication.count
      .mockResolvedValueOnce(100) // appsTotal
      .mockResolvedValueOnce(80)  // appsSubmitted
      .mockResolvedValueOnce(10)  // appsInterview
      .mockResolvedValueOnce(2)   // appsOffer
    mockPrisma.survey.count.mockResolvedValue(0)
    mockPrisma.user.count.mockResolvedValue(0)

    const result = await getLast30DaysMetrics()

    expect(result.appsTotal).toBe(100)
    expect(result.appsSubmitted).toBe(80)
    expect(result.submissionSuccessRate).toBe(80)
  })

  it('returns null rates when denominators are zero', async () => {
    mockPrisma.jobApplication.count.mockResolvedValue(0)
    mockPrisma.survey.count.mockResolvedValue(0)
    mockPrisma.user.count.mockResolvedValue(0)

    const result = await getLast30DaysMetrics()

    expect(result.submissionSuccessRate).toBeNull()
    expect(result.interviewRateSurvey).toBeNull()
    expect(result.interviewRateApps).toBeNull()
    expect(result.refundRate).toBeNull()
  })

  it('computes survey-based interview rate', async () => {
    mockPrisma.jobApplication.count
      .mockResolvedValueOnce(200) // total
      .mockResolvedValueOnce(180) // submitted
      .mockResolvedValueOnce(0)   // interview
      .mockResolvedValueOnce(0)   // offer
    mockPrisma.survey.count
      .mockResolvedValueOnce(3)   // surveyYes
      .mockResolvedValueOnce(10)  // surveyTotal
    mockPrisma.user.count.mockResolvedValue(0)

    const result = await getLast30DaysMetrics()
    expect(result.interviewRateSurvey).toBe(30) // 3/10 = 30%
  })
})
