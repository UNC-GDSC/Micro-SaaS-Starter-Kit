import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getStripeSession } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { getPlanById } from '@/lib/pricing'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()

    // Accept planId (preferred) or legacy priceId.
    // Price IDs are server-only env vars — never bundled into the client,
    // so the client sends a plan slug and we resolve the price ID here.
    let priceId: string | null = body.priceId ?? null

    if (body.planId) {
      const plan = getPlanById(body.planId)
      priceId = plan.priceId ?? null
    }

    if (!priceId) {
      return new NextResponse(
        'This plan is not available for purchase. Stripe price ID is not configured on the server.',
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    const checkoutSession = await getStripeSession({
      priceId,
      customerId: user?.stripeCustomerId || undefined,
      userId: session.user.id,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error creating checkout session:', message)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
