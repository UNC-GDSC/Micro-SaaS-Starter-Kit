import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/user/preferences
 *
 * Merges the request body into the user's preferences JSON column.
 * Only whitelisted keys are accepted to prevent arbitrary writes.
 *
 * Currently accepted keys:
 *   tailorApplications: boolean
 */

const ALLOWED_KEYS = ['tailorApplications'] as const
type AllowedKey = (typeof ALLOWED_KEYS)[number]

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

  // Whitelist — only allow known preference keys
  const updates: Record<string, boolean | string | number | null> = {}
  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      const v = body[key]
      if (typeof v === 'boolean' || typeof v === 'string' || typeof v === 'number' || v === null) {
        updates[key] = v
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid preference keys provided' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  })

  const current = (user?.preferences as Record<string, unknown> | null) ?? {}
  const merged: Record<string, boolean | string | number | null> = {
    ...(current as Record<string, boolean | string | number | null>),
    ...updates,
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferences: merged as object },
  })

  return NextResponse.json({ ok: true, preferences: merged })
}

export async function GET(_req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  })

  return NextResponse.json({
    preferences: (user?.preferences as Record<string, unknown> | null) ?? {},
  })
}
