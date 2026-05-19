import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { EXIT_REASONS, type ExitReason } from '@/lib/pmf/types'

const VALID_REASONS = EXIT_REASONS.map((r) => r.value) as string[]

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { reason?: string; otherText?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { reason, otherText } = body

  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: 'A valid exit reason is required.' },
      { status: 422 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeSubscriptionId: true },
  })

  if (!user?.stripeSubscriptionId) {
    return NextResponse.json({ error: 'No active subscription found.' }, { status: 404 })
  }

  // Cancel the subscription at period end (not immediately)
  await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: true,
    metadata: {
      refundReason: reason,
      ...(reason === 'other' && otherText ? { refundReasonText: otherText } : {}),
    },
  })

  // Store exit reason immediately; cancelledAt will be set by the
  // customer.subscription.deleted webhook when the period actually ends.
  // We set it here too so the PMF dashboard reflects intent-to-cancel right away.
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      refundReason: reason as ExitReason,
      cancelledAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}
