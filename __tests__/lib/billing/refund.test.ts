/**
 * Unit tests for lib/billing/refund.ts — checkRefundEligibility()
 *
 * Pure function tests: no I/O, no mocks required.
 */
import { checkRefundEligibility, type RefundUser } from '@/lib/billing/refund'

/** Helper: build a fully-eligible user; override any field per test. */
function eligibleUser(overrides: Partial<RefundUser> = {}): RefundUser {
  return {
    refundedAt: null,
    firstPaidAt: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days ago — well within 30
    stripeSubscriptionId: 'sub_test_123',
    stripeCustomerId: 'cus_test_123',
    ...overrides,
  }
}

describe('checkRefundEligibility', () => {
  it('returns eligible: true for a healthy paying user within 30 days', () => {
    const result = checkRefundEligibility(eligibleUser())
    expect(result.eligible).toBe(true)
  })

  // ── Ineligibility rule 1: already refunded ────────────────────────────────
  it('returns already_refunded when refundedAt is set', () => {
    const result = checkRefundEligibility(eligibleUser({ refundedAt: new Date() }))
    expect(result.eligible).toBe(false)
    if (!result.eligible) expect(result.reason).toBe('already_refunded')
  })

  // ── Ineligibility rule 2: never paid ─────────────────────────────────────
  it('returns never_paid when firstPaidAt is null', () => {
    const result = checkRefundEligibility(eligibleUser({ firstPaidAt: null }))
    expect(result.eligible).toBe(false)
    if (!result.eligible) expect(result.reason).toBe('never_paid')
  })

  // ── Ineligibility rule 3: outside 30-day window ───────────────────────────
  it('returns outside_30_day_window when firstPaidAt is exactly 31 days ago', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 3600 * 1000)
    const result = checkRefundEligibility(eligibleUser({ firstPaidAt: thirtyOneDaysAgo }))
    expect(result.eligible).toBe(false)
    if (!result.eligible) expect(result.reason).toBe('outside_30_day_window')
  })

  it('returns eligible: true when firstPaidAt is exactly 30 days ago (edge — still in window)', () => {
    // Exactly 30 days = daysSince ≈ 30.0 → NOT > 30 → should be eligible
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000 + 60_000) // 1 minute buffer
    const result = checkRefundEligibility(eligibleUser({ firstPaidAt: thirtyDaysAgo }))
    expect(result.eligible).toBe(true)
  })

  // ── Ineligibility rule 4: no active subscription ──────────────────────────
  it('returns no_active_subscription when stripeSubscriptionId is null', () => {
    const result = checkRefundEligibility(eligibleUser({ stripeSubscriptionId: null }))
    expect(result.eligible).toBe(false)
    if (!result.eligible) expect(result.reason).toBe('no_active_subscription')
  })

  // ── Ineligibility rule 5: no Stripe customer ─────────────────────────────
  it('returns no_stripe_customer when stripeCustomerId is null', () => {
    const result = checkRefundEligibility(eligibleUser({ stripeCustomerId: null }))
    expect(result.eligible).toBe(false)
    if (!result.eligible) expect(result.reason).toBe('no_stripe_customer')
  })

  // ── Priority: already_refunded beats other rules ──────────────────────────
  it('returns already_refunded even when also outside the 30-day window', () => {
    const result = checkRefundEligibility(
      eligibleUser({
        refundedAt: new Date(),
        firstPaidAt: new Date(Date.now() - 60 * 24 * 3600 * 1000), // 60 days ago
      })
    )
    expect(result.eligible).toBe(false)
    if (!result.eligible) expect(result.reason).toBe('already_refunded')
  })

  // ── Priority: never_paid beats outside_30_day_window ─────────────────────
  it('returns never_paid when firstPaidAt is null regardless of other fields', () => {
    const result = checkRefundEligibility(
      eligibleUser({
        firstPaidAt: null,
        stripeSubscriptionId: null,
      })
    )
    expect(result.eligible).toBe(false)
    if (!result.eligible) expect(result.reason).toBe('never_paid')
  })
})
