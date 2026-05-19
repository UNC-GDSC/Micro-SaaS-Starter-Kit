/**
 * PATCH /api/inbox/messages/:id/read
 *
 * Marks a single inbox message as read.
 * Only the owning user can mark their own messages.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership before updating
  const msg = await prisma.inboxMessage.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!msg) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.inboxMessage.update({
    where: { id },
    data: { isRead: true },
  })

  return NextResponse.json({ ok: true })
}
