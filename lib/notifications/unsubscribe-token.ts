/**
 * lib/notifications/unsubscribe-token.ts
 *
 * Tamper-proof, no-login unsubscribe tokens.
 *
 * Format: `<userId>.<hmac-sha256>`
 * The HMAC is computed over the userId using CRON_SECRET as the key.
 * If CRON_SECRET is not set, tokens still work but are unsigned (dev only).
 */

import { createHmac, timingSafeEqual } from 'crypto'

function secret(): Buffer {
  const s = process.env.CRON_SECRET ?? 'dev-unsubscribe-secret'
  return Buffer.from(s, 'utf8')
}

function sign(userId: string): string {
  return createHmac('sha256', secret()).update(userId).digest('hex')
}

/** Create a token for the given userId. */
export function createUnsubscribeToken(userId: string): string {
  const sig = sign(userId)
  // Base64-URL encode so the token is URL-safe without extra escaping
  return Buffer.from(`${userId}.${sig}`).toString('base64url')
}

/** Verify and extract userId. Returns null on invalid/tampered token. */
export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const dotIndex = decoded.lastIndexOf('.')
    if (dotIndex < 0) return null

    const userId = decoded.slice(0, dotIndex)
    const receivedSig = decoded.slice(dotIndex + 1)
    const expectedSig = sign(userId)

    // Constant-time comparison to avoid timing attacks
    const a = Buffer.from(receivedSig, 'hex')
    const b = Buffer.from(expectedSig, 'hex')
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null

    return userId
  } catch {
    return null
  }
}
