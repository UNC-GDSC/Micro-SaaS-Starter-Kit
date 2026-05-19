/**
 * lib/inbox/inbound-utils.ts
 *
 * Pure helper functions for the inbound webhook route.
 * Extracted into this module so they can be unit-tested without
 * importing Next.js server APIs (which require a browser/edge runtime).
 */

import { createHmac, timingSafeEqual } from 'crypto'

// ── Signature verification ─────────────────────────────────────────────────

/**
 * Verify a Resend inbound webhook signature.
 * Expected header format: "v1=<hex-hmac-sha256>"
 */
export function verifyResendSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
): boolean {
  if (!sigHeader) return false

  const prefixedHex = sigHeader.startsWith('v1=') ? sigHeader.slice(3) : sigHeader

  let receivedBuf: Buffer
  try {
    receivedBuf = Buffer.from(prefixedHex, 'hex')
  } catch {
    return false
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest()
  if (expected.length !== receivedBuf.length) return false

  return timingSafeEqual(expected, receivedBuf)
}

// ── Address parsers ────────────────────────────────────────────────────────

/** Parse "Full Name <email>" or bare "email" → { fromName, fromEmail } */
export function parseFrom(raw: string): { fromName: string | null; fromEmail: string } {
  const m = raw.match(/^(.+?)\s*<([^>]+)>$/)
  if (m) return { fromName: m[1].trim() || null, fromEmail: m[2].trim().toLowerCase() }
  return { fromName: null, fromEmail: raw.trim().toLowerCase() }
}

/**
 * Extract inboxHandle and optional applicationId from a "to" address.
 *   "alex-7g3k+clyq7x2pc@inbox.resumeai-bot.ru"
 *      → { handle: "alex-7g3k", applicationId: "clyq7x2pc" }
 *   "alex-7g3k@inbox.resumeai-bot.ru"
 *      → { handle: "alex-7g3k", applicationId: null }
 */
export function parseToAddress(
  to: string,
  inboxDomain: string,
): { handle: string; applicationId: string | null } | null {
  const lower = to.trim().toLowerCase()
  if (!lower.endsWith(`@${inboxDomain}`)) return null

  const local = lower.split('@')[0]
  const plusIdx = local.indexOf('+')

  if (plusIdx >= 0) {
    return {
      handle: local.slice(0, plusIdx),
      applicationId: local.slice(plusIdx + 1) || null,
    }
  }

  return { handle: local, applicationId: null }
}
