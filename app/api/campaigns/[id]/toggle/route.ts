import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params

  const campaign = await prisma.autoApplyCampaign.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!campaign) return new NextResponse('Not found', { status: 404 })

  const updated = await prisma.autoApplyCampaign.update({
    where: { id },
    data: { isActive: !campaign.isActive },
  })

  return NextResponse.json({ id: updated.id, isActive: updated.isActive })
}
