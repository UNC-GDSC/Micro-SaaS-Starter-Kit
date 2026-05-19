/**
 * POST /api/inbox/inbound
 *
 * Resend inbound-email webhook.  Called by Resend whenever a message
 * arrives at *@inbox.resumeai-bot.ru.
 *
 * Flow:
 *  1. Verify Resend-Signature (HMAC-SHA256; skip when RESEND_WEBHOOK_SECRET
 *     is not set — safe for local dev, must be set in production).
 *  2. Parse from / to / subject / body from the Resend payload.
 *  3. Extract inboxHandle (and optional applicationId from plus-addressing)
 *     from the "to" address.
 *  4. Look up the User by inboxHandle.
 *  5. Classify with AI (gpt-4o-mini) or regex fast-path.
 *  6. Persist InboxMessage row.
 *  7. Side-effects:
 *       INTERVIEW_REQUEST → ApplicationEvent + set application.status=INTERVIEW
 *       REJECTION         → set application.status=REJECTED
 *  8. Return 200 to stop Resend retries.
 *
 * Auth: Resend-Signature: v1=<hex-hmac> header (HMAC-SHA256 of raw body)
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyEmail } from '@/lib/inbox/classify'
import { verifyResendSignature, parseFrom, parseToAddress } from '@/lib/inbox/inbound-utils'
import { publishEvent } from '@/lib/redis'

const INBOX_DOMAIN = process.env.INBOX_DOMAIN ?? 'inbox.resumeai-bot.ru'

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody = await req.text()

  // ── 1. Signature verification ───────────────────────────────────────────
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (webhookSecret) {
    const sig =
      req.headers.get('resend-signature') ??
      req.headers.get('svix-signature')   // fallback: Resend uses svix infra
    if (!verifyResendSignature(rawBody, sig, webhookSecret)) {
      console.warn('[inbox/inbound] signature verification failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── 2. Parse payload ────────────────────────────────────────────────────
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resend inbound payload shape:
  //   { from, to (string | string[]), subject, text, html, headers }
  const rawTo: string = Array.isArray(payload.to)
    ? String(payload.to[0] ?? '')
    : String(payload.to ?? '')

  const rawFrom: string = String(payload.from ?? '')
  const subject: string = String(payload.subject ?? '(no subject)')
  const bodyText: string = String(payload.text ?? payload.plain_text ?? '')
  const bodyHtml: string | null = payload.html ? String(payload.html) : null

  // ── 3. Extract handle + applicationId ──────────────────────────────────
  const parsed = parseToAddress(rawTo, INBOX_DOMAIN)
  if (!parsed) {
    // Not addressed to our inbox domain — nothing to do; 200 to stop retries
    console.warn('[inbox/inbound] unrecognised to address', rawTo)
    return NextResponse.json({ ok: true, skipped: 'unknown_domain' })
  }

  // ── 4. Look up user ─────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { inboxHandle: parsed.handle },
    select: { id: true },
  })
  if (!user) {
    console.warn('[inbox/inbound] no user for handle', parsed.handle)
    return NextResponse.json({ ok: true, skipped: 'unknown_handle' })
  }

  // ── 5. Validate applicationId ───────────────────────────────────────────
  let applicationId: string | null = null
  if (parsed.applicationId) {
    const app = await prisma.jobApplication.findFirst({
      where: { id: parsed.applicationId, userId: user.id },
      select: { id: true },
    })
    applicationId = app?.id ?? null
  }

  const { fromName, fromEmail } = parseFrom(rawFrom)

  // ── 6. Classify ─────────────────────────────────────────────────────────
  const { classification } = await classifyEmail({ fromEmail, subject, bodyText })

  // ── 7. Persist ──────────────────────────────────────────────────────────
  const message = await prisma.inboxMessage.create({
    data: {
      userId: user.id,
      applicationId,
      fromEmail,
      fromName,
      subject,
      bodyText,
      bodyHtml,
      classification,
    },
  })

  // ── 8. Side-effects based on classification ─────────────────────────────
  if (applicationId) {
    if (classification === 'INTERVIEW_REQUEST') {
      await Promise.all([
        prisma.applicationEvent.create({
          data: {
            applicationId,
            type: 'interview_requested',
            payload: { messageId: message.id, fromEmail },
          },
        }),
        prisma.jobApplication.update({
          where: { id: applicationId },
          data: { status: 'INTERVIEW', responseAt: new Date() },
        }),
      ])
      // P18: notify via Telegram
      await publishEvent('application_events', {
        type: 'interview_reply',
        userId: user.id,
        applicationId,
        company: fromName || fromEmail,
        timestamp: new Date().toISOString(),
      })
    } else if (classification === 'REJECTION') {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: 'REJECTED', responseAt: new Date() },
      })
    }
  }

  console.log('[inbox/inbound] saved', {
    messageId: message.id,
    userId: user.id,
    handle: parsed.handle,
    classification,
    applicationId,
  })

  return NextResponse.json({ ok: true, messageId: message.id })
}
