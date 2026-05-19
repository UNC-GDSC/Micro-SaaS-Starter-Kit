/**
 * PATCH /api/user/notifications
 * GET  /api/user/notifications
 *
 * Manages notification preferences stored as proper User columns:
 *   - dailyDigestEnabled (boolean)
 *   - timezone           (IANA string, e.g. "Europe/Moscow")
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Basic IANA timezone sanity-check (does not enumerate all zones)
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dailyDigestEnabled: true, timezone: true },
  })

  return NextResponse.json({
    dailyDigestEnabled: user?.dailyDigestEnabled ?? true,
    timezone: user?.timezone ?? 'UTC',
  })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data: { dailyDigestEnabled?: boolean; timezone?: string } = {}

  if ('dailyDigestEnabled' in body) {
    if (typeof body.dailyDigestEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'dailyDigestEnabled must be a boolean' },
        { status: 400 }
      )
    }
    data.dailyDigestEnabled = body.dailyDigestEnabled
  }

  if ('timezone' in body) {
    if (typeof body.timezone !== 'string' || !isValidTimezone(body.timezone)) {
      return NextResponse.json(
        { error: 'timezone must be a valid IANA timezone string' },
        { status: 400 }
      )
    }
    data.timezone = body.timezone
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { dailyDigestEnabled: true, timezone: true },
  })

  return NextResponse.json(updated)
}
