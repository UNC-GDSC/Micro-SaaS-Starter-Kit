/**
 * GET /api/inbox/messages
 *
 * Returns the authenticated user's inbox messages, most recent first.
 *
 * Query params:
 *   filter  — InboxClass to filter by (omit for all)
 *   take    — page size, max 100 (default 50)
 *   skip    — offset for pagination (default 0)
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InboxClass } from '@prisma/client'

const VALID_CLASSES = new Set<string>(Object.values(InboxClass))

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter')
  const take = Math.min(Math.max(Number(searchParams.get('take') ?? 50), 1), 100)
  const skip = Math.max(Number(searchParams.get('skip') ?? 0), 0)

  const where = {
    userId: session.user.id,
    ...(filter && VALID_CLASSES.has(filter)
      ? { classification: filter as InboxClass }
      : {}),
  }

  const [messages, total] = await Promise.all([
    prisma.inboxMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take,
      skip,
      select: {
        id: true,
        fromEmail: true,
        fromName: true,
        subject: true,
        bodyText: true,
        classification: true,
        receivedAt: true,
        isRead: true,
        application: {
          select: { id: true, jobTitle: true, company: true },
        },
      },
    }),
    prisma.inboxMessage.count({ where }),
  ])

  return NextResponse.json({ messages, total, take, skip })
}
