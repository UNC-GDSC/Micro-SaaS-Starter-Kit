/**
 * lib/auth/handle-mint.ts
 *
 * Generates a unique inbox handle for a new user.
 * Format:  <email-base>-<4-random-chars>   e.g. "alex-7g3k"
 *
 * The base is derived from the email local-part (first 8 alphanumeric
 * chars, lowercase).  A 4-char random suffix is appended and uniqueness
 * checked against the DB.  Retries up to 10 times; falls back to a fully
 * random handle if all 10 collide (astronomically unlikely at scale).
 *
 * Called once from lib/auth.ts events.createUser — never called again for
 * the same user.
 */

import { prisma } from '@/lib/prisma'

const HANDLE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Cryptographically-sufficient random slug of given length */
function randomSlug(length: number): string {
  let s = ''
  for (let i = 0; i < length; i++) {
    s += HANDLE_CHARS[Math.floor(Math.random() * HANDLE_CHARS.length)]
  }
  return s
}

/**
 * Derive a URL-safe base from an email local-part.
 * "Alex.O'Brien+jobs" → "alexobrie"  (≤8 chars, alphanumeric only)
 */
function baseFromEmail(email: string): string {
  const slug = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8)
  return slug || 'user'
}

/**
 * Mint a unique inbox handle for the given user.
 * Writes the handle to User.inboxHandle and returns it.
 *
 * @throws never — falls back to a random handle if all attempts fail
 */
export async function mintInboxHandle(userId: string, email: string): Promise<string> {
  const base = baseFromEmail(email)

  for (let attempt = 0; attempt < 10; attempt++) {
    const handle = `${base}-${randomSlug(4)}`

    const existing = await prisma.user.findUnique({
      where: { inboxHandle: handle },
      select: { id: true },
    })

    if (!existing) {
      await prisma.user.update({
        where: { id: userId },
        data: { inboxHandle: handle },
      })
      return handle
    }
  }

  // Extreme fallback: full random handle (never seen in practice)
  const fallback = `u-${randomSlug(8)}`
  await prisma.user.update({
    where: { id: userId },
    data: { inboxHandle: fallback },
  })
  return fallback
}
