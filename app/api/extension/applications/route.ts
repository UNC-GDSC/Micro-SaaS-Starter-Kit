/**
 * POST /api/extension/applications
 *
 * Record a manual job application submitted via the Chrome extension.
 * Authenticated via extension Bearer key (scope='extension').
 *
 * Body:
 * {
 *   jobTitle:  string  (required)
 *   company:   string  (required)
 *   jobUrl:    string  (required)
 *   location?: string
 *   resumeId?: string  // defaults to user's default resume
 * }
 *
 * Creates a JobApplication with source=MANUAL, status=SUBMITTED, appliedAt=now.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateExtensionRequest } from '@/lib/extension-auth'

export async function POST(request: Request) {
  const auth = await validateExtensionRequest(request)
  if (!auth.valid) {
    return new NextResponse(auth.error ?? 'Unauthorized', { status: 401 })
  }

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return new NextResponse('Invalid JSON body', { status: 400 })
  }

  const { jobTitle, company, jobUrl, location, resumeId } = body

  if (!jobTitle || !company || !jobUrl) {
    return new NextResponse('jobTitle, company, and jobUrl are required', { status: 400 })
  }

  try {
    // Resolve resume: use provided resumeId or fall back to default
    let resolvedResumeId: string | null = null
    if (resumeId) {
      const resume = await prisma.resume.findFirst({
        where: { id: resumeId, userId: auth.userId! },
        select: { id: true },
      })
      resolvedResumeId = resume?.id ?? null
    }

    if (!resolvedResumeId) {
      const defaultResume = await prisma.resume.findFirst({
        where: { userId: auth.userId! },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
      })
      resolvedResumeId = defaultResume?.id ?? null
    }

    const application = await prisma.jobApplication.create({
      data: {
        userId: auth.userId!,
        resumeId: resolvedResumeId,
        source: 'MANUAL',
        status: 'SUBMITTED',
        jobTitle: String(jobTitle).slice(0, 255),
        company: String(company).slice(0, 255),
        location: location ? String(location).slice(0, 255) : null,
        jobUrl: String(jobUrl).slice(0, 2048),
        appliedAt: new Date(),
      },
      select: {
        id: true,
        jobTitle: true,
        company: true,
        status: true,
        appliedAt: true,
      },
    })

    return NextResponse.json({ success: true, application }, { status: 201 })
  } catch (err: any) {
    console.error('[extension/applications] error:', err)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
