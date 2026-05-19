/**
 * Unit tests for lib/notifications/unsubscribe-token.ts
 *
 * Tests HMAC token round-trip, tamper detection, and timing-safe compare.
 */

import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '@/lib/notifications/unsubscribe-token'

describe('createUnsubscribeToken / verifyUnsubscribeToken', () => {
  it('round-trips: createToken then verify returns the userId', () => {
    const userId = 'user_abc123'
    const token = createUnsubscribeToken(userId)
    expect(verifyUnsubscribeToken(token)).toBe(userId)
  })

  it('works with a CUID-style userId', () => {
    const userId = 'clrqz5zp400008y8r3f2g8j0x'
    const token = createUnsubscribeToken(userId)
    expect(verifyUnsubscribeToken(token)).toBe(userId)
  })

  it('returns null for an empty string', () => {
    expect(verifyUnsubscribeToken('')).toBeNull()
  })

  it('returns null for a plaintext userId (no signature)', () => {
    const base64 = Buffer.from('user_abc123').toString('base64url')
    expect(verifyUnsubscribeToken(base64)).toBeNull()
  })

  it('returns null for a tampered userId segment', () => {
    const token = createUnsubscribeToken('user_abc123')
    // Decode, alter userId, re-encode
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const dotIdx = decoded.lastIndexOf('.')
    const tampered = 'user_evil' + decoded.slice(dotIdx)
    const tamperedToken = Buffer.from(tampered).toString('base64url')
    expect(verifyUnsubscribeToken(tamperedToken)).toBeNull()
  })

  it('returns null for a tampered signature segment', () => {
    const token = createUnsubscribeToken('user_abc123')
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const dotIdx = decoded.lastIndexOf('.')
    // Replace last char of sig with a different char
    const sig = decoded.slice(dotIdx + 1)
    const badSig = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a')
    const tampered = decoded.slice(0, dotIdx + 1) + badSig
    const tamperedToken = Buffer.from(tampered).toString('base64url')
    expect(verifyUnsubscribeToken(tamperedToken)).toBeNull()
  })

  it('returns null for completely random garbage', () => {
    expect(verifyUnsubscribeToken('this-is-not-a-real-token-abc')).toBeNull()
  })

  it('produces URL-safe tokens (no +, /, = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const userId = `user_${Math.random().toString(36).slice(2)}`
      const token = createUnsubscribeToken(userId)
      expect(token).not.toMatch(/[+/=]/)
    }
  })

  it('two different userIds produce different tokens', () => {
    const t1 = createUnsubscribeToken('user_one')
    const t2 = createUnsubscribeToken('user_two')
    expect(t1).not.toBe(t2)
  })
})
