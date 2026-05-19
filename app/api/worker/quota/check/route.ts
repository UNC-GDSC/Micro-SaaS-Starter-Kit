import { NextResponse } from 'next/server'
import { canSendApplication } from '@/lib/quota'

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

  const { userId } = body as { userId?: string }
  if (!userId) return new NextResponse('userId is required', { status: 400 })

  const allowed = await canSendApplication(userId)
  return NextResponse.json({ allowed })
}
