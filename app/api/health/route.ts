/**
 * GET /api/health
 *
 * Application-level liveness probe.
 * Used by the smoke-test script after each deploy.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.npm_package_version ?? 'unknown',
    timestamp: new Date().toISOString(),
  })
}
