/**
 * TEMPORARY QA-only endpoint — created for Prompt 15 Sentry smoke test (G1).
 * DELETE THIS FILE AFTER CONFIRMING SENTRY RECEIVED THE ERROR.
 *
 * Usage:  GET /api/debug-smoke/raise?secret=<CRON_SECRET>
 * Returns 500 and throws a tagged error that Sentry will capture.
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Intentional error — Sentry should capture this
  throw new Error('[QA G1] Sentry smoke test — safe to ignore after verification')
}
