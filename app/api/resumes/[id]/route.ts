import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const resume = await prisma.resume.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!resume) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(resume)
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const existing = await prisma.resume.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return new NextResponse('Not found', { status: 404 })

  await prisma.resume.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
