/**
 * worker-client.ts — thin bridge from Next.js → Python FastAPI worker.
 *
 * All server-side calls to the worker go through here so that:
 *  - WORKER_SECRET is never leaked to the browser
 *  - Sentry captures every non-2xx unconditionally
 *  - Caller only needs to handle the already-parsed JSON body
 */
import * as Sentry from '@sentry/nextjs'

export class WorkerError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message: string,
  ) {
    super(message)
    this.name = 'WorkerError'
  }
}

/**
 * POST `path` to the Python worker and return the parsed JSON response.
 *
 * @param path  Worker-relative path, e.g. `/health` or `/jobs/scrape/adzuna`
 * @param body  Request body — omit or pass `undefined` for bodyless requests
 */
export async function callWorker<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const baseUrl = process.env.WORKER_URL
  const secret = process.env.WORKER_SECRET

  if (!baseUrl || !secret) {
    throw new Error(
      'WORKER_URL and WORKER_SECRET must be set before calling the worker',
    )
  }

  const url = `${baseUrl.replace(/\/$/, '')}${path}`

  let response: Response
  try {
    response = await fetch(url, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (networkErr) {
    const err = new WorkerError(0, path, `Worker unreachable: ${String(networkErr)}`)
    Sentry.captureException(err, { extra: { path, url } })
    throw err
  }

  if (!response.ok) {
    let detail = ''
    try {
      const payload = await response.json()
      detail = payload?.detail ?? JSON.stringify(payload)
    } catch {
      detail = await response.text().catch(() => '')
    }

    const err = new WorkerError(
      response.status,
      path,
      `Worker responded ${response.status}: ${detail}`,
    )
    Sentry.captureException(err, {
      extra: { path, url, status: response.status, detail },
    })
    throw err
  }

  return response.json() as Promise<T>
}
