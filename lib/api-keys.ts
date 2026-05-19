import { nanoid } from 'nanoid'
import { prisma } from './prisma'
import bcrypt from 'bcrypt'

const API_KEY_PREFIX = 'sk_'
const API_KEY_LENGTH = 32

export async function generateApiKey(
  userId: string,
  name: string,
  expiresAt?: Date,
  scope?: string,
) {
  const rawKey = `${API_KEY_PREFIX}${nanoid(API_KEY_LENGTH)}`
  const hashedKey = await bcrypt.hash(rawKey, 10)

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      key: hashedKey,
      userId,
      expiresAt,
      scope: scope ?? null,
    },
  })

  // Return the raw key only once (user needs to save it)
  return { apiKey, rawKey }
}

export async function validateApiKey(rawKey: string): Promise<{
  valid: boolean
  userId?: string
  apiKeyId?: string
  scope?: string | null
}> {
  if (!rawKey.startsWith(API_KEY_PREFIX)) {
    return { valid: false }
  }

  // Include non-expiring keys (expiresAt IS NULL) and not-yet-expired keys
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  })

  for (const apiKey of apiKeys) {
    const isValid = await bcrypt.compare(rawKey, apiKey.key)
    if (isValid) {
      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsed: new Date() },
      })

      return { valid: true, userId: apiKey.userId, apiKeyId: apiKey.id, scope: apiKey.scope }
    }
  }

  return { valid: false }
}

/**
 * Validate an extension-scoped API key.
 * Only compares against keys that have scope='extension', which is much faster
 * than scanning all keys when the user has many general-purpose keys.
 */
export async function validateExtensionKey(rawKey: string): Promise<{
  valid: boolean
  userId?: string
  apiKeyId?: string
}> {
  if (!rawKey.startsWith(API_KEY_PREFIX)) {
    return { valid: false }
  }

  const apiKeys = await prisma.apiKey.findMany({
    where: {
      scope: 'extension',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  })

  for (const apiKey of apiKeys) {
    const isValid = await bcrypt.compare(rawKey, apiKey.key)
    if (isValid) {
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsed: new Date() },
      })
      return { valid: true, userId: apiKey.userId, apiKeyId: apiKey.id }
    }
  }

  return { valid: false }
}

export async function revokeApiKey(apiKeyId: string, userId: string) {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
  })

  if (!apiKey) {
    throw new Error('API key not found')
  }

  await prisma.apiKey.delete({
    where: { id: apiKeyId },
  })

  return true
}

export async function getUserApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      scope: true,
      lastUsed: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}
