import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/applications/[id]/preview
 *
 * Returns the tailored resume + cover letter that was submitted for a
 * specific JobApplication.  Used by the dashboard detail view to let
 * users inspect what ResumeAI actually sent on their behalf.
 *
 * Auth: session required; user may only access their own applications.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const application = await prisma.jobApplication.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      jobTitle: true,
      company: true,
      resumeId: true,
      tailoredResume: true,
      tailoredCoverLetter: true,
      tailoringTokensUsed: true,
      tailoringModelUsed: true,
      resume: {
        select: { title: true, generated: true },
      },
    },
  })

  if (!application) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Ownership check — users may not see other users' applications
  if (application.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    id: application.id,
    jobTitle: application.jobTitle,
    company: application.company,
    baseResume: application.resume?.generated ?? null,
    baseResumeTitle: application.resume?.title ?? null,
    tailoredResume: application.tailoredResume ?? null,
    tailoredCoverLetter: application.tailoredCoverLetter ?? null,
    tailoringTokensUsed: application.tailoringTokensUsed ?? null,
    tailoringModelUsed: application.tailoringModelUsed ?? null,
    tailored: application.tailoredResume !== null,
  })
}
