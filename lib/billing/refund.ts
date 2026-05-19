/**
 * lib/billing/refund.ts
 *
 * Refund eligibility logic for the 30-day money-back guarantee.
 *
 * Rules (all must pass for a refund to proceed):
 *  1. never_already_refunded  — refundedAt must be null
 *  2. has_first_payment       — firstPaidAt must be set
 *  3. within_30_day_window    — firstPaidAt ≤ 30 days ago
 *  4. has_active_subscription — stripeSubscriptionId must be set
 *  5. has_stripe_customer     — stripeCustomerId must be set (needed for charge lookup)
 *
 * Keeping the 5 checks here (not in the route) makes them unit-testable
 * without touching the database or Stripe API.
 */

export type RefundIneligibleReason =
  | 'already_refunded'
  | 'never_paid'
  | 'outside_30_day_window'
  | 'no_active_subscription'
  | 'no_stripe_customer'

export type RefundEligibility =
  | { eligible: true }
  | { eligible: false; reason: RefundIneligibleReason }

export interface RefundUser {
  refundedAt: Date | null
  firstPaidAt: Date | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
}

/** Pure function — no I/O, safe to unit-test without mocks. */
export function checkRefundEligibility(user: RefundUser): RefundEligibility {
  if (user.refundedAt != null) {
    return { eligible: false, reason: 'already_refunded' }
  }

  if (user.firstPaidAt == null) {
    return { eligible: false, reason: 'never_paid' }
  }

  const msPerDay = 1000 * 60 * 60 * 24
  const daysSinceFirstPayment = (Date.now() - user.firstPaidAt.getTime()) / msPerDay
  if (daysSinceFirstPayment > 30) {
    return { eligible: false, reason: 'outside_30_day_window' }
  }

  if (!user.stripeSubscriptionId) {
    return { eligible: false, reason: 'no_active_subscription' }
  }

  if (!user.stripeCustomerId) {
    return { eligible: false, reason: 'no_stripe_customer' }
  }

  return { eligible: true }
}

/** Human-readable message for each ineligibility reason (for API error responses). */
export const REFUND_INELIGIBLE_MESSAGES: Record<RefundIneligibleReason, string> = {
  already_refunded:
    'A refund has already been issued for your account. Our guarantee covers one refund per customer.',
  never_paid:
    'No payment was found on your account.',
  outside_30_day_window:
    'Your 30-day money-back window has passed. The guarantee applies within 30 days of your first payment.',
  no_active_subscription:
    'No active subscription was found on your account.',
  no_stripe_customer:
    'Billing information is incomplete. Please contact support.',
}
