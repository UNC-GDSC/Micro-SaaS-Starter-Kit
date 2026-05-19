import { isAdminEmail } from '@/lib/pmf/admin'

const original = process.env.ADMIN_EMAILS

afterEach(() => {
  if (original === undefined) {
    delete process.env.ADMIN_EMAILS
  } else {
    process.env.ADMIN_EMAILS = original
  }
})

describe('isAdminEmail', () => {
  it('returns false when ADMIN_EMAILS is not set', () => {
    delete process.env.ADMIN_EMAILS
    expect(isAdminEmail('admin@example.com')).toBe(false)
  })

  it('returns false for null / undefined email', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })

  it('returns true for an exact match', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    expect(isAdminEmail('admin@example.com')).toBe(true)
  })

  it('is case-insensitive', () => {
    process.env.ADMIN_EMAILS = 'Admin@Example.com'
    expect(isAdminEmail('admin@example.com')).toBe(true)
    expect(isAdminEmail('ADMIN@EXAMPLE.COM')).toBe(true)
  })

  it('handles multiple comma-separated emails', () => {
    process.env.ADMIN_EMAILS = 'a@x.com, b@x.com , c@x.com'
    expect(isAdminEmail('a@x.com')).toBe(true)
    expect(isAdminEmail('b@x.com')).toBe(true)
    expect(isAdminEmail('c@x.com')).toBe(true)
    expect(isAdminEmail('d@x.com')).toBe(false)
  })

  it('denies a non-admin email', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    expect(isAdminEmail('hacker@evil.com')).toBe(false)
  })

  it('handles trailing whitespace in ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = '  admin@example.com  '
    expect(isAdminEmail('admin@example.com')).toBe(true)
  })
})
