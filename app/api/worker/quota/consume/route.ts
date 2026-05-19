import { NextResponse } from 'next/server'
import { consumeQuota } from '@/lib/quota'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const workerSecret = process.env.WORKER_SECRET

  if (!workerSecret || authHeader !== `Bearer ${workerSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const { userId, jobApplicationId } = body as {
    userId?: string
    jobApplicationId?: string
  }

  if (!userId || !jobApplicationId) {
    return new NextResponse('userId and jobApplicationId are required', { status: 400 })
  }

  await consumeQuota(userId, jobApplicationId)
  return NextResponse.json({ ok: true })
}
