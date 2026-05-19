import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getStripeSession } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

    const { priceId } = await req.json()
    if (!priceId) return new NextResponse('Price ID is required', { status: 400 })

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
    console.error('Error creating checkout session:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
