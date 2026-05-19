/**
 * GET /api/worker/health
 *
 * Proxy to the Python worker's /health endpoint.
 * Used to verify the Next.js → worker bridge works end-to-end.
 *
 * Returns the worker's own health payload:
 *   { status: "ok", version: "...", db: "ok"|"error", timestamp: "..." }
 */
import { NextResponse } from 'next/server'
import { callWorker } from '@/lib/worker-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await callWorker('/health')
    return NextResponse.json(data)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 502
    const message =
      err instanceof Error ? err.message : 'Worker health check failed'
    return NextResponse.json({ error: message }, { status })
  }
}
