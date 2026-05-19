import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SurveyAnswer } from '@/lib/pmf/types'

type Body =
  | { surveyId: string; action: 'shown' }
  | { surveyId: string; action: 'dismiss' }
  | { surveyId: string; action: 'answer'; answer: SurveyAnswer; interviewCount?: number }

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { surveyId, action } = body

  // Verify the survey belongs to the logged-in user
  const survey = await prisma.survey.findFirst({
    where: { id: surveyId, userId: session.user.id },
  })
  if (!survey) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  }

  const now = new Date()

  if (action === 'shown') {
    // Only set shownAt if not already set
    if (!survey.shownAt) {
      await prisma.survey.update({
        where: { id: surveyId },
        data: { shownAt: now },
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'dismiss') {
    // Reset shownAt to now so the 24h re-show window resets
    await prisma.survey.update({
      where: { id: surveyId },
      data: { shownAt: now },
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'answer') {
    const { answer, interviewCount } = body as Extract<Body, { action: 'answer' }>
    if (!['yes', 'no', 'not_sure'].includes(answer)) {
      return NextResponse.json({ error: 'Invalid answer' }, { status: 400 })
    }

    await prisma.survey.update({
      where: { id: surveyId },
      data: {
        shownAt: survey.shownAt ?? now,
        answeredAt: now,
        response: {
          answer,
          ...(interviewCount !== undefined && { interviewCount }),
        },
      },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
