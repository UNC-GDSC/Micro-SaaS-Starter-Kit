/**
 * Fernet symmetric encryption (https://github.com/fernet/spec/blob/master/Spec.md)
 * implemented using Node.js built-in `crypto` module.
 *
 * Token format (base64url):
 *   Version (1 byte 0x80)
 *   Timestamp (8 bytes big-endian uint64)
 *   IV (16 bytes)
 *   Ciphertext (AES-128-CBC, PKCS7-padded, multiple of 16 bytes)
 *   HMAC-SHA256 (32 bytes) over all preceding bytes
 *
 * Key is 32 bytes (256-bit) base64url-encoded.
 * First 16 bytes = signing key, last 16 bytes = encryption key.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto'

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY environment variable is not set')
  // Support both standard base64 and base64url
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
  const buf = Buffer.from(normalized, 'base64')
  if (buf.length !== 32) throw new Error(`ENCRYPTION_KEY must be 32 bytes (got ${buf.length})`)
  return buf
}

export function encryptLinkedInPassword(plaintext: string): string {
  const key = getKey()
  const signingKey = key.subarray(0, 16)
  const encryptionKey = key.subarray(16, 32)

  const iv = randomBytes(16)
  const timestamp = BigInt(Math.floor(Date.now() / 1000))

  // AES-128-CBC with PKCS7 padding
  const cipher = createCipheriv('aes-128-cbc', encryptionKey, iv)
  const plaintextBuf = Buffer.from(plaintext, 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()])

  // Build the token prefix (before HMAC)
  const versionByte = Buffer.from([0x80])
  const timestampBuf = Buffer.allocUnsafe(8)
  timestampBuf.writeBigUInt64BE(timestamp)

  const prefix = Buffer.concat([versionByte, timestampBuf, iv, ciphertext])

  // HMAC-SHA256 over prefix
  const hmac = createHmac('sha256', signingKey)
  hmac.update(prefix)
  const mac = hmac.digest()

  const token = Buffer.concat([prefix, mac])
  // Fernet uses URL-safe base64 without padding
  return token.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function decryptLinkedInPassword(ciphertext: string): string {
  const key = getKey()
  const signingKey = key.subarray(0, 16)
  const encryptionKey = key.subarray(16, 32)

  // Restore standard base64 with padding
  let b64 = ciphertext.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  const token = Buffer.from(b64, 'base64')

  if (token.length < 57) throw new Error('Fernet token too short')
  if (token[0] !== 0x80) throw new Error('Invalid Fernet version')

  const prefix = token.subarray(0, token.length - 32)
  const mac = token.subarray(token.length - 32)

  // Verify HMAC
  const hmac = createHmac('sha256', signingKey)
  hmac.update(prefix)
  const expectedMac = hmac.digest()
  if (!timingSafeEqual(mac, expectedMac)) throw new Error('Invalid Fernet token (HMAC mismatch)')

  const iv = token.subarray(9, 25)
  const encryptedData = token.subarray(25, token.length - 32)

  const decipher = createDecipheriv('aes-128-cbc', encryptionKey, iv)
  const plaintext = Buffer.concat([decipher.update(encryptedData), decipher.final()])
  return plaintext.toString('utf8')
}
