import { NextRequest, NextResponse } from 'next/server'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export interface RateLimitConfig {
  interval: number // Time window in milliseconds
  uniqueTokenPerInterval: number // Max number of unique tokens per interval
}

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  check(limit: number, token: string): { success: boolean; reset: number; remaining: number } {
    const now = Date.now()
    const tokenData = store[token]

    if (!tokenData || now > tokenData.resetTime) {
      store[token] = {
        count: 1,
        resetTime: now + this.config.interval,
      }
      return { success: true, reset: store[token].resetTime, remaining: limit - 1 }
    }

    if (tokenData.count >= limit) {
      return {
        success: false,
        reset: tokenData.resetTime,
        remaining: 0,
      }
    }

    tokenData.count++
    return {
      success: true,
      reset: tokenData.resetTime,
      remaining: limit - tokenData.count,
    }
  }
}

// Default rate limiter: 10 requests per 10 seconds
export const defaultRateLimiter = new RateLimiter({
  interval: 10 * 1000,
  uniqueTokenPerInterval: 500,
})

// API rate limiter: 100 requests per minute
export const apiRateLimiter = new RateLimiter({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
})

export function getClientIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : req.headers.get('x-real-ip') ?? 'unknown'
  return ip
}

export function rateLimitMiddleware(
  limiter: RateLimiter = defaultRateLimiter,
  limit: number = 10
) {
  return async (req: NextRequest) => {
    const identifier = getClientIdentifier(req)
    const { success, reset, remaining } = limiter.check(limit, identifier)

    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          reset: new Date(reset).toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(reset).toISOString(),
          },
        }
      )
    }

    return null // Allow request to proceed
  }
}
