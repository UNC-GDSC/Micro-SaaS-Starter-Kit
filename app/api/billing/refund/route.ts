/**
 * POST /api/billing/refund
 *
 * Issues a full refund under the 30-day money-back guarantee:
 *  1. Auth + eligibility check (5 rules in lib/billing/refund.ts)
 *  2. Retrieves the latest invoice's charge from Stripe
 *  3. Creates a full refund via Stripe API
 *  4. Cancels the subscription immediately
 *  5. Updates the DB: refundedAt, cancelledAt, clears stripe subscription fields
 *  6. Sends confirmation email
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getPlanByPriceId } from '@/lib/pricing'
import {
  checkRefundEligibility,
  REFUND_INELIGIBLE_MESSAGES,
} from '@/lib/billing/refund'
import { sendRefundConfirmationEmail } from '@/lib/billing/email-refund-confirmation'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Load user and check eligibility ──────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      refundedAt: true,
      firstPaidAt: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const eligibility = checkRefundEligibility(user)
  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: REFUND_INELIGIBLE_MESSAGES[eligibility.reason], reason: eligibility.reason },
      { status: 422 }
    )
  }

  // ── 2. Find the latest paid charge via the subscription's latest invoice ────
  let chargeId: string | null = null
  let amountCents = 0
  let currency = 'usd'

  try {
    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId!,
      { expand: ['latest_invoice'] }
    )

    const invoice = subscription.latest_invoice
    if (invoice && typeof invoice !== 'string') {
      const chargeField = invoice.charge
      if (typeof chargeField === 'string') {
        chargeId = chargeField
      } else if (chargeField && typeof chargeField === 'object') {
        chargeId = chargeField.id
      }
      amountCents = invoice.amount_paid
      currency = invoice.currency
    }
  } catch (err) {
    console.error('[refund] Failed to retrieve subscription/invoice:', err)
    return NextResponse.json(
      { error: 'Could not retrieve your billing information. Please contact support.' },
      { status: 502 }
    )
  }

  if (!chargeId) {
    return NextResponse.json(
      { error: 'No charge found to refund. Please contact support.' },
      { status: 422 }
    )
  }

  // ── 3. Issue the full refund ─────────────────────────────────────────────────
  try {
    await stripe.refunds.create({
      charge: chargeId,
      reason: 'requested_by_customer',
      metadata: { userId: user.id, type: '30_day_guarantee' },
    })
  } catch (err) {
    console.error('[refund] Stripe refund failed:', err)
    return NextResponse.json(
      { error: 'Failed to process refund. Please contact support.' },
      { status: 502 }
    )
  }

  // ── 4. Cancel the subscription immediately ───────────────────────────────────
  try {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId!)
  } catch (err) {
    // Non-fatal — refund already issued; log and continue
    console.error('[refund] Failed to cancel subscription (refund still issued):', err)
  }

  // ── 5. Update the database ───────────────────────────────────────────────────
  const freePlan = getPlanByPriceId(null)
  const now = new Date()

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refundedAt: now,
      cancelledAt: now,
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
      dailyApplicationLimit: freePlan.dailyLimit,
    },
  })

  // ── 6. Send confirmation email (non-blocking; failure doesn't abort) ─────────
  if (user.email) {
    sendRefundConfirmationEmail({
      to: user.email,
      name: user.name,
      amountCents,
      currency,
    }).catch((err) => console.error('[refund] Email send failed:', err))
  }

  return NextResponse.json({ ok: true, amountCents, currency })
}
