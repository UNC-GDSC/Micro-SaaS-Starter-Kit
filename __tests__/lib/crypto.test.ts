import { encryptLinkedInPassword, decryptLinkedInPassword } from '@/lib/crypto'

const TEST_KEY = 'bV4UmliwP4xFApJTnq5O5XxJ4mltOC4bjrQQ7EdCUtc='

describe('Fernet crypto', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  it('round-trips encrypt/decrypt', () => {
    const pt = 'test-password-123'
    expect(decryptLinkedInPassword(encryptLinkedInPassword(pt))).toBe(pt)
  })

  it('round-trips arbitrary unicode strings', () => {
    const pt = 'P@ssw0rd!_тест_日本語'
    expect(decryptLinkedInPassword(encryptLinkedInPassword(pt))).toBe(pt)
  })

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const pt = 'same-input'
    const ct1 = encryptLinkedInPassword(pt)
    const ct2 = encryptLinkedInPassword(pt)
    expect(ct1).not.toBe(ct2)
    // Both must still decrypt correctly
    expect(decryptLinkedInPassword(ct1)).toBe(pt)
    expect(decryptLinkedInPassword(ct2)).toBe(pt)
  })

  it('decrypts Python-produced ciphertext', () => {
    const fixture = require('../../worker/tests/fixtures/fernet_sample.json') as {
      key: string
      plaintext: string
      ciphertext: string
    }
    process.env.ENCRYPTION_KEY = fixture.key
    expect(decryptLinkedInPassword(fixture.ciphertext)).toBe(fixture.plaintext)
  })

  it('throws on tampered ciphertext', () => {
    const ct = encryptLinkedInPassword('secret')
    // Flip a character to corrupt the HMAC
    const tampered = ct.slice(0, -4) + 'XXXX'
    expect(() => decryptLinkedInPassword(tampered)).toThrow()
  })

  it('throws when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encryptLinkedInPassword('x')).toThrow('ENCRYPTION_KEY')
  })
})
