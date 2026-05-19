/**
 * POST /api/notifications/telegram/connect
 *
 * Authenticated (session required). Generates a short-lived signed token and
 * returns the Telegram deep-link that the user clicks to start the bot.
 *
 * Response: { deepLink: "https://t.me/<BOT_USERNAME>?start=<token>" }
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { signTelegramToken } from '@/lib/telegram-token'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Return current connection status
  const chat = await prisma.telegramChat.findUnique({
    where: { userId: session.user.id },
    select: {
      chatId: true,
      username: true,
      connectedAt: true,
      notifyOnSubmit: true,
      notifyOnInterviewReply: true,
      notifyOnLinkedInIssue: true,
    },
  })

  return NextResponse.json({ connected: !!chat, chat })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  if (!botUsername) {
    return new NextResponse('TELEGRAM_BOT_USERNAME is not configured', { status: 503 })
  }

  const token = signTelegramToken(session.user.id)
  const deepLink = `https://t.me/${botUsername}?start=${token}`

  return NextResponse.json({ deepLink, expiresIn: 300 })
}

export async function PATCH(req: Request) {
  /**
   * Update notification toggles.
   * Body: { notifyOnSubmit?, notifyOnInterviewReply?, notifyOnLinkedInIssue? }
   */
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const allowedKeys = ['notifyOnSubmit', 'notifyOnInterviewReply', 'notifyOnLinkedInIssue'] as const
  const data: Partial<Record<typeof allowedKeys[number], boolean>> = {}
  for (const key of allowedKeys) {
    if (typeof body[key] === 'boolean') data[key] = body[key]
  }

  if (Object.keys(data).length === 0) {
    return new NextResponse('No valid toggle keys provided', { status: 400 })
  }

  const updated = await prisma.telegramChat.updateMany({
    where: { userId: session.user.id },
    data,
  })

  if (updated.count === 0) {
    return new NextResponse('Not connected', { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  /** Disconnect — removes the TelegramChat row. */
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  await prisma.telegramChat.deleteMany({ where: { userId: session.user.id } })
  return NextResponse.json({ ok: true })
}
