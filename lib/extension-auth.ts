/**
 * extension-auth.ts — Authenticate Chrome extension API requests.
 *
 * Extension endpoints accept `Authorization: Bearer <key>` where the key was
 * generated via /extension/connect with scope='extension'.
 *
 * We validate only extension-scoped keys (faster bcrypt scan) and return the
 * userId so route handlers can query the DB without an extra join.
 */
import { validateExtensionKey } from './api-keys'

export interface ExtensionAuthResult {
  valid: boolean
  userId?: string
  apiKeyId?: string
  error?: string
}

/**
 * Parse and validate an extension Bearer token from the Authorization header.
 *
 * @example
 * const auth = await validateExtensionRequest(request)
 * if (!auth.valid) return new Response(auth.error, { status: 401 })
 */
export async function validateExtensionRequest(
  request: Request,
): Promise<ExtensionAuthResult> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing Authorization header' }
  }

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey) {
    return { valid: false, error: 'Empty bearer token' }
  }

  const result = await validateExtensionKey(rawKey)
  if (!result.valid) {
    return { valid: false, error: 'Invalid or expired extension key' }
  }

  return { valid: true, userId: result.userId, apiKeyId: result.apiKeyId }
}
