/**
 * POST /api/notifications/telegram/webhook
 *
 * Receives Telegram Bot API updates. Registered via setWebhook.
 * Handles ONLY the /start command. All other messages get a canned reply.
 *
 * /start <token>  → verify token → upsert TelegramChat → reply confirmation
 * /stop           → delete TelegramChat row → reply confirmation
 * anything else   → "Please manage notifications from the dashboard"
 *
 * Security: verifies X-Telegram-Bot-Api-Secret-Token header when
 *   TELEGRAM_WEBHOOK_SECRET is set (strongly recommended in production).
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTelegramToken } from '@/lib/telegram-token'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://resumeai-bot.ru'
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

async function sendTelegramMessage(chatId: string | number, text: string, url?: string) {
  if (!BOT_TOKEN) return
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' }
  if (url) {
    body.reply_markup = {
      inline_keyboard: [[{ text: 'Open Dashboard', url }]],
    }
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => console.error('[telegram/webhook] sendMessage failed:', err.message))
}

export async function POST(req: Request) {
  // ── 1. Verify webhook secret ───────────────────────────────────────────────
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (webhookSecret) {
    const provided = req.headers.get('x-telegram-bot-api-secret-token')
    if (provided !== webhookSecret) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }

  // ── 2. Parse update ────────────────────────────────────────────────────────
  let update: Record<string, any>
  try {
    update = await req.json()
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const message = update.message
  if (!message?.text) {
    // Non-message update (e.g. edited_message, callback_query) — ignore
    return NextResponse.json({ ok: true })
  }

  const chatId = String(message.chat.id)
  const fromId = String(message.from?.id ?? message.chat.id)
  const username: string | undefined = message.from?.username
  const text: string = message.text.trim()

  // ── 3. /stop — disconnect ──────────────────────────────────────────────────
  if (text === '/stop' || text.startsWith('/stop ')) {
    await prisma.telegramChat.deleteMany({ where: { chatId } })
    await sendTelegramMessage(
      chatId,
      '🔕 Disconnected. You will no longer receive notifications.\n\nReconnect any time from your dashboard.',
      `${APP_URL}/dashboard/notifications`,
    )
    return NextResponse.json({ ok: true })
  }

  // ── 4. /start [token] — connect ────────────────────────────────────────────
  if (text.startsWith('/start')) {
    const parts = text.split(' ')
    const token = parts[1]?.trim()

    if (!token) {
      // /start without token — bot opened directly
      await sendTelegramMessage(
        chatId,
        '👋 Hi! This bot sends ResumeAI job application notifications.\n\nTo connect, visit your <b>ResumeAI dashboard → Notifications</b> and click <b>Connect Telegram</b>.',
        `${APP_URL}/dashboard/notifications`,
      )
      return NextResponse.json({ ok: true })
    }

    const verified = verifyTelegramToken(token)
    if (!verified) {
      await sendTelegramMessage(
        chatId,
        '⚠️ This link has expired or is invalid. Please generate a new one from your dashboard.',
        `${APP_URL}/dashboard/notifications`,
      )
      return NextResponse.json({ ok: true })
    }

    // Upsert TelegramChat — one user can reconnect from a different device
    await prisma.telegramChat.upsert({
      where: { userId: verified.userId },
      create: {
        userId: verified.userId,
        chatId,
        username: username ?? null,
      },
      update: {
        chatId,
        username: username ?? null,
        connectedAt: new Date(),
      },
    })

    await sendTelegramMessage(
      chatId,
      '✅ <b>Connected!</b> You\'ll receive notifications here for:\n• ✉️ New applications submitted\n• 📬 Recruiter replies\n• ⚠️ LinkedIn auth issues\n\nManage settings from your dashboard.',
      `${APP_URL}/dashboard/notifications`,
    )
    return NextResponse.json({ ok: true })
  }

  // ── 5. Any other message — canned reply ────────────────────────────────────
  await sendTelegramMessage(
    chatId,
    '💡 This bot only sends notifications. Manage your settings from the ResumeAI dashboard.',
    `${APP_URL}/dashboard/notifications`,
  )
  return NextResponse.json({ ok: true })
}
