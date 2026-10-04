import { getEnv } from '../env'

export type RateLimiterOptions = {
  windowMs: number
  maxRequests: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Each key's window starts at its first request (same as the old in-memory limiter), so there
// is no clock-boundary burst. SQLite evaluates every SET expression against the old row.
// ponytail: rows never swept; add a cron DELETE if the table grows
export const checkRateLimit = async (
  key: string,
  { windowMs, maxRequests }: RateLimiterOptions,
  now = Date.now(),
): Promise<RateLimitResult> => {
  try {
    const row = await getEnv()
      .DB.prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
         ON CONFLICT(key) DO UPDATE SET
           count = CASE WHEN window_start > ? THEN count + 1 ELSE 1 END,
           window_start = CASE WHEN window_start > ? THEN window_start ELSE excluded.window_start END
         RETURNING count, window_start`,
      )
      .bind(key, now, now - windowMs, now - windowMs)
      .first<{ count: number; window_start: number }>()
    const count = Number(row?.count ?? 1)
    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt: Number(row?.window_start ?? now) + windowMs,
    }
  } catch (error) {
    // Fail open: a storage hiccup should not lock everyone out.
    console.warn('rate_limit_check_failed', { key, error })
    return { allowed: true, remaining: maxRequests, resetAt: now + windowMs }
  }
}
