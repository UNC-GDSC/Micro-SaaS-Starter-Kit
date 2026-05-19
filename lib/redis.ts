/**
 * lib/redis.ts — Shared ioredis client for pub/sub and job queues.
 *
 * Exports:
 *   getRedis()           — singleton ioredis connection (lazy)
 *   publishEvent(ch, p)  — fire-and-forget pub to a Redis channel
 *
 * Used by:
 *   lib/quota.ts          → publishes application_submitted
 *   app/api/inbox/…       → publishes interview_reply
 *   BullMQ queues (lib/jobs.ts) — keep their own connection
 */
import Redis from 'ioredis'

let _client: Redis | null = null

export function getRedis(): Redis {
  if (!_client) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379'
    _client = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      // Don't crash the process if Redis is unreachable; pub/sub is best-effort
      reconnectOnError: () => true,
    })
    _client.on('error', (err) => {
      console.warn('[redis] connection error (non-fatal):', err.message)
    })
  }
  return _client
}

/**
 * Publish a JSON payload to a Redis pub/sub channel.
 * Never throws — silently swallowed so a Redis outage never breaks the
 * primary request path.
 */
export async function publishEvent(
  channel: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await getRedis().publish(channel, JSON.stringify(payload))
  } catch (err: any) {
    console.warn(`[redis] publish to ${channel} failed (non-fatal):`, err.message)
  }
}
