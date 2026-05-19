import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptLinkedInPassword } from '@/lib/crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const campaigns = await prisma.autoApplyCampaign.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { resume: { select: { title: true } } },
  })

  return NextResponse.json(campaigns)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const {
    resumeId,
    source,
    keywords,
    locations,
    excludeCompanies,
    dailyLimit,
    linkedinEmail,
    linkedinPassword,
  } = body as {
    resumeId: string
    source: string
    keywords: string[]
    locations: string[]
    excludeCompanies: string[]
    dailyLimit: number
    linkedinEmail?: string
    linkedinPassword?: string
  }

  if (!resumeId || !source) {
    return new NextResponse('resumeId and source are required', { status: 400 })
  }

  // Verify the resume belongs to this user
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId: session.user.id },
  })
  if (!resume) return new NextResponse('Resume not found', { status: 404 })

  // Encrypt LinkedIn password if provided
  let linkedinPasswordEnc: string | undefined
  if (linkedinPassword && linkedinPassword.length > 0) {
    try {
      linkedinPasswordEnc = encryptLinkedInPassword(linkedinPassword)
    } catch {
      return new NextResponse('Encryption error — check ENCRYPTION_KEY', { status: 500 })
    }
  }

  const campaignName = `${Array.isArray(keywords) ? keywords[0] : 'Campaign'} — ${source}`

  const campaign = await prisma.autoApplyCampaign.create({
    data: {
      userId: session.user.id,
      resumeId,
      name: campaignName,
      source: source as 'LINKEDIN' | 'CAREEROPS',
      keywords: Array.isArray(keywords) ? keywords : [],
      locations: Array.isArray(locations) ? locations : [],
      excludeCompanies: Array.isArray(excludeCompanies) ? excludeCompanies : [],
      dailyLimit: Number(dailyLimit) || 5,
      linkedinEmail: linkedinEmail || null,
      linkedinPasswordEnc: linkedinPasswordEnc || null,
    },
  })

  return NextResponse.json(campaign, { status: 201 })
}
