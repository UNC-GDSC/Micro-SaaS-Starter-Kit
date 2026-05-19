/**
 * telegram-token.ts — Short-lived signed tokens for the Telegram connect flow.
 *
 * Format:  base64url(json_payload) + "." + base64url(hmac_sha256_signature)
 * Secret:  NEXTAUTH_SECRET (already present on all instances)
 * TTL:     5 minutes
 *
 * Used by:
 *   POST /api/notifications/telegram/connect   → sign a token for the deep link
 *   POST /api/notifications/telegram/webhook   → verify /start <token>
 */
import { createHmac, timingSafeEqual } from 'crypto'

const TOKEN_TTL_S = 5 * 60 // 5 minutes

interface TokenPayload {
  userId: string
  iat: number
  exp: number
}

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET is not set')
  return s
}

export function signTelegramToken(userId: string): string {
  const payload: TokenPayload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S,
  }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyTelegramToken(token: string): { userId: string } | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot < 1) return null

    const data = token.slice(0, dot)
    const sig = token.slice(dot + 1)

    // Timing-safe comparison
    const expected = createHmac('sha256', getSecret()).update(data).digest('base64url')
    const sigBuf = Buffer.from(sig, 'base64url')
    const expBuf = Buffer.from(expected, 'base64url')
    if (sigBuf.length !== expBuf.length) return null
    if (!timingSafeEqual(sigBuf, expBuf)) return null

    const payload: TokenPayload = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return { userId: payload.userId }
  } catch {
    return null
  }
}
