/**
 * Unit tests for lib/auth/handle-mint.ts
 *
 * Covers:
 *  - Happy path: valid handle minted and returned
 *  - Uniqueness: retries on collision until a free handle is found
 *  - Fallback: u-<8random> handle used after 10 collisions
 *  - Email normalisation: special chars stripped, length capped
 */

// ── Prisma mock ────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

import { mintInboxHandle } from '@/lib/auth/handle-mint'

// ── Helpers ────────────────────────────────────────────────────────────────

function noCollision() {
  mockFindUnique.mockResolvedValue(null) // handle is always free
  mockUpdate.mockResolvedValue({})
}

function collideNTimes(n: number) {
  // Resolve with a user object for the first n calls (collision),
  // then null for the n+1th (free)
  let calls = 0
  mockFindUnique.mockImplementation(() => {
    calls++
    return Promise.resolve(calls <= n ? { id: 'existing-user' } : null)
  })
  mockUpdate.mockResolvedValue({})
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

describe('mintInboxHandle', () => {
  it('returns a handle on the happy path', async () => {
    noCollision()
    const handle = await mintInboxHandle('user_1', 'alex@example.com')

    // Format: <base>-<4chars>
    expect(handle).toMatch(/^[a-z0-9]+-[a-z0-9]{4}$/)
    expect(handle.startsWith('alex-')).toBe(true)

    // Wrote the handle to DB
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { inboxHandle: handle } }),
    )
  })

  it('retries exactly once on a single collision and finds a free handle', async () => {
    collideNTimes(1)

    const handle = await mintInboxHandle('user_2', 'bob@example.com')
    expect(handle).toMatch(/^bob-[a-z0-9]{4}$/)

    // findUnique called twice: once for the collision, once for the free handle
    expect(mockFindUnique).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('is unique under 9 consecutive collisions (retries 9 times)', async () => {
    collideNTimes(9)

    const handle = await mintInboxHandle('user_3', 'charlie@example.com')
    expect(handle).toMatch(/^charlie-[a-z0-9]{4}$/) // "charlie" is 7 chars, within 8-char cap

    expect(mockFindUnique).toHaveBeenCalledTimes(10) // 9 collisions + 1 success
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('falls back to u-<8random> after 10 consecutive collisions', async () => {
    collideNTimes(10)

    const handle = await mintInboxHandle('user_4', 'dana@example.com')
    // Fallback format: u-<8 alphanumeric>
    expect(handle).toMatch(/^u-[a-z0-9]{8}$/)

    // findUnique called exactly 10 times for the retry loop,
    // then skipped for the fallback
    expect(mockFindUnique).toHaveBeenCalledTimes(10)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('strips special characters from email local-part', async () => {
    noCollision()
    const handle = await mintInboxHandle('user_5', 'alex.o+jobs@company.co')
    // "alex.o+jobs" → strip non-alnum → "alexojobs" → slice 8 → "alexojob"
    expect(handle.startsWith('alexojob-')).toBe(true)
  })

  it('caps the base at 8 characters', async () => {
    noCollision()
    const handle = await mintInboxHandle('user_6', 'averylongemail@example.com')
    const base = handle.split('-')[0]
    expect(base.length).toBeLessThanOrEqual(8)
  })

  it('falls back to "user" base for an email with only special chars', async () => {
    noCollision()
    const handle = await mintInboxHandle('user_7', '+++@example.com')
    expect(handle.startsWith('user-')).toBe(true)
  })

  it('produces handles with only lowercase alphanumerics and a single hyphen', async () => {
    noCollision()
    for (let i = 0; i < 20; i++) {
      jest.clearAllMocks()
      noCollision()
      const handle = await mintInboxHandle(`user_${i}`, `test${i}@example.com`)
      expect(handle).toMatch(/^[a-z0-9]+-[a-z0-9]{4}$/)
    }
  })

  it('two different emails produce different handles (with no collisions)', async () => {
    noCollision()
    const h1 = await mintInboxHandle('user_8', 'alice@example.com')
    jest.clearAllMocks()
    noCollision()
    const h2 = await mintInboxHandle('user_9', 'bob@example.com')

    // Bases differ → handles differ even if suffixes happened to match
    expect(h1.split('-')[0]).not.toBe(h2.split('-')[0])
  })
})
