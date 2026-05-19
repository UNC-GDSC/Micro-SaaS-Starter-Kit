import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callWorker } from '@/lib/worker-client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const resumes = await prisma.resume.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(resumes)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const {
    targetRole,
    yearsExp,
    location,
    remote,
    workHistory,
    education,
    skills,
    tone,
  } = body as Record<string, unknown>

  if (!targetRole) return new NextResponse('targetRole is required', { status: 400 })

  let generated: unknown = {}
  try {
    generated = await callWorker('/jobs/resume/generate', {
      targetRole,
      yearsExp,
      location,
      remote,
      workHistory,
      education,
      skills,
      tone,
    })
  } catch {
    // If the worker is unavailable, store the raw input and continue
    generated = { error: 'Worker unavailable — resume will be generated when the worker is back online.' }
  }

  const title = `${targetRole} — ${new Date().getFullYear()}`

  const resume = await prisma.resume.create({
    data: {
      userId: session.user.id,
      title,
      targetRole: String(targetRole),
      input: body as object,
      generated: generated as object,
      language: 'en',
    },
  })

  return NextResponse.json(resume, { status: 201 })
}
