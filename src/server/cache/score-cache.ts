import { getEnv } from '../env'
import type { SlopScoreResult } from '../scoring'

type CacheEntry = {
  value: SlopScoreResult
  expiresAt: number
}

const getKey = (username: string) => `score:v1:${username.toLowerCase()}`

// KV is best-effort: a read/write failure degrades to a cache miss, never a failed request.
export const getCachedScore = async (
  username: string,
  now: Date,
): Promise<SlopScoreResult | null> => {
  try {
    const entry = (await getEnv().CACHE.get(
      getKey(username),
      'json',
    )) as CacheEntry | null
    if (!entry || entry.expiresAt <= now.getTime()) {
      return null
    }
    return entry.value
  } catch (error) {
    console.warn('score_cache_read_failed', { username, error })
    return null
  }
}

export const setCachedScore = async (
  username: string,
  value: SlopScoreResult,
  now: Date,
  ttlMs: number,
): Promise<void> => {
  const entry: CacheEntry = { value, expiresAt: now.getTime() + ttlMs }
  try {
    await getEnv().CACHE.put(getKey(username), JSON.stringify(entry), {
      expirationTtl: Math.max(60, Math.ceil(ttlMs / 1000)),
    })
  } catch (error) {
    console.warn('score_cache_write_failed', { username, error })
  }
}
