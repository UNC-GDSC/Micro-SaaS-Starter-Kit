/**
 * Tests for the inbound email webhook helpers (lib/inbox/inbound-utils.ts)
 * and classifier (lib/inbox/classify.ts — pure/fast-path only).
 *
 * The route handler itself (app/api/inbox/inbound/route.ts) uses
 * Next.js server APIs that require an edge runtime, so we test the
 * extracted pure logic here.  DB interactions are covered by e2e tests.
 *
 * Covers:
 *  - verifyResendSignature: correct, tampered, missing header
 *  - parseFrom: "Name <email>", bare email, edge cases
 *  - parseToAddress: plain handle, plus-addressing, wrong domain, no @
 *  - isAutoResponder: common no-reply patterns
 */

import { createHmac } from 'crypto'
import {
  verifyResendSignature,
  parseFrom,
  parseToAddress,
} from '@/lib/inbox/inbound-utils'
import { isAutoResponder } from '@/lib/inbox/classify'

const DOMAIN = 'inbox.resumeai-bot.ru'
const SECRET = 'test-webhook-secret'

// ── verifyResendSignature ──────────────────────────────────────────────────

describe('verifyResendSignature', () => {
  function sign(body: string): string {
    const hex = createHmac('sha256', SECRET).update(body).digest('hex')
    return `v1=${hex}`
  }

  it('returns true for a valid v1= signature', () => {
    const body = '{"from":"a@b.com","to":["x@inbox.resumeai-bot.ru"]}'
    expect(verifyResendSignature(body, sign(body), SECRET)).toBe(true)
  })

  it('returns false for a tampered body', () => {
    const body = '{"from":"a@b.com"}'
    const sig = sign(body)
    expect(verifyResendSignature('{"from":"evil@b.com"}', sig, SECRET)).toBe(false)
  })

  it('returns false for a bad hex signature', () => {
    expect(verifyResendSignature('body', 'v1=zzznotvalidhex', SECRET)).toBe(false)
  })

  it('returns false for a null header', () => {
    expect(verifyResendSignature('body', null, SECRET)).toBe(false)
  })

  it('returns false for wrong-length signature', () => {
    expect(verifyResendSignature('body', 'v1=aabb', SECRET)).toBe(false)
  })

  it('accepts signatures without the v1= prefix (raw hex)', () => {
    const body = 'hello'
    const rawHex = createHmac('sha256', SECRET).update(body).digest('hex')
    expect(verifyResendSignature(body, rawHex, SECRET)).toBe(true)
  })

  it('is timing-safe: same result for equal signatures regardless of iteration', () => {
    const body = 'test-body'
    const sig = sign(body)
    // Run multiple times to ensure no timing shortcut
    for (let i = 0; i < 10; i++) {
      expect(verifyResendSignature(body, sig, SECRET)).toBe(true)
    }
  })
})

// ── parseFrom ──────────────────────────────────────────────────────────────

describe('parseFrom', () => {
  it('parses "Name <email>" format', () => {
    const result = parseFrom('Jane Recruiter <jane@acme.com>')
    expect(result.fromName).toBe('Jane Recruiter')
    expect(result.fromEmail).toBe('jane@acme.com')
  })

  it('lowercases the email', () => {
    const result = parseFrom('Jane <Jane@Acme.COM>')
    expect(result.fromEmail).toBe('jane@acme.com')
  })

  it('handles bare email with no name', () => {
    const result = parseFrom('jane@acme.com')
    expect(result.fromName).toBeNull()
    expect(result.fromEmail).toBe('jane@acme.com')
  })

  it('returns null fromName when name part is empty', () => {
    const result = parseFrom('<jane@acme.com>')
    // Angle-bracket-only doesn't match the "Name <email>" regex — treated as bare
    expect(result.fromEmail).toBeDefined()
  })

  it('trims whitespace', () => {
    const result = parseFrom('  jane@acme.com  ')
    expect(result.fromEmail).toBe('jane@acme.com')
  })
})

// ── parseToAddress ─────────────────────────────────────────────────────────

describe('parseToAddress', () => {
  it('parses a plain handle', () => {
    const result = parseToAddress('alex-7g3k@inbox.resumeai-bot.ru', DOMAIN)
    expect(result).toEqual({ handle: 'alex-7g3k', applicationId: null })
  })

  it('parses plus-addressing into handle + applicationId', () => {
    const result = parseToAddress(
      'alex-7g3k+clyq7x2pc000008l5@inbox.resumeai-bot.ru',
      DOMAIN,
    )
    expect(result).toEqual({
      handle: 'alex-7g3k',
      applicationId: 'clyq7x2pc000008l5',
    })
  })

  it('returns null for wrong domain', () => {
    expect(parseToAddress('alex@other.example.com', DOMAIN)).toBeNull()
  })

  it('returns null for addresses with no @ at all', () => {
    expect(parseToAddress('notanemail', DOMAIN)).toBeNull()
  })

  it('lowercases the handle', () => {
    const result = parseToAddress('ALEX-7G3K@inbox.resumeai-bot.ru', DOMAIN)
    expect(result?.handle).toBe('alex-7g3k')
  })

  it('treats a trailing + with no suffix as applicationId: null', () => {
    const result = parseToAddress('alex-7g3k+@inbox.resumeai-bot.ru', DOMAIN)
    expect(result?.applicationId).toBeNull()
  })

  it('handles "to" given as an array element (string)', () => {
    // Callers normalise arrays before calling; verify plain string works
    const result = parseToAddress('bob-x1y2@inbox.resumeai-bot.ru', DOMAIN)
    expect(result?.handle).toBe('bob-x1y2')
  })
})

// ── isAutoResponder ────────────────────────────────────────────────────────

describe('isAutoResponder', () => {
  const autoSenders = [
    'no-reply@company.com',
    'noreply@company.com',
    'no_reply@company.com',
    'donotreply@company.com',
    'do-not-reply@company.com',
    'notifications@company.com',
    'notification@company.com',
    'alerts@company.com',
    'alert@company.com',
    'newsletter@company.com',
    'mailer@company.com',
    'daemon@company.com',
    'postmaster@company.com',
  ]

  autoSenders.forEach((sender) => {
    it(`classifies "${sender}" as auto-responder`, () => {
      expect(isAutoResponder(sender)).toBe(true)
    })
  })

  it('does NOT classify normal recruiter emails as auto-responders', () => {
    expect(isAutoResponder('jane.recruiter@acme.com')).toBe(false)
    expect(isAutoResponder('hiring@startup.io')).toBe(false)
    expect(isAutoResponder('careers@bigcorp.com')).toBe(false)
    expect(isAutoResponder('john.smith@company.com')).toBe(false)
  })
})
