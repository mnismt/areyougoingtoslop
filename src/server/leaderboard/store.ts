import Redis from 'ioredis'
import type { LeaderboardEntry } from './types'

export type LeaderboardStoreOptions = {
  now?: Date
  maxEntries?: number
  minUpdateIntervalMinutes?: number
  confidenceFloor?: 'low' | 'medium' | 'high'
  limit?: number
}

type LeaderboardState = {
  entries: LeaderboardEntry[]
}

const DEFAULT_MAX_ENTRIES = 200
const DEFAULT_MIN_UPDATE_INTERVAL_MINUTES = 10
const DEFAULT_LIMIT = 50
const DEFAULT_CONFIDENCE_FLOOR: LeaderboardStoreOptions['confidenceFloor'] =
  'medium'

const LEADERBOARD_KEY = 'ays:leaderboard:v1:state'
const UNIQUE_COUNT_KEY = 'ays:leaderboard:v1:unique-count'

const confidenceRank: Record<
  NonNullable<LeaderboardStoreOptions['confidenceFloor']>,
  number
> = {
  low: 0,
  medium: 1,
  high: 2,
}

const getRedisUrl = () => {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) {
    return null
  }
  return redisUrl
}

const createRedisClient = (url: string) => {
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  })
}

let commandClient: Redis | null = null

const getCommandClient = (): Redis | null => {
  if (commandClient) {
    return commandClient
  }
  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    console.warn('Redis URL not configured for leaderboard')
    return null
  }
  commandClient = createRedisClient(redisUrl)
  return commandClient
}

const loadState = async (): Promise<LeaderboardState> => {
  const redis = getCommandClient()
  if (!redis) {
    return { entries: [] }
  }
  try {
    const raw = await redis.get(LEADERBOARD_KEY)
    if (!raw) {
      return { entries: [] }
    }
    const parsed = JSON.parse(raw) as LeaderboardState
    if (!parsed || !Array.isArray(parsed.entries)) {
      return { entries: [] }
    }
    return parsed
  } catch (err: unknown) {
    console.warn('Failed to load leaderboard state from Redis:', err)
    return { entries: [] }
  }
}

const sortEntries = (entries: LeaderboardEntry[]) =>
  entries.sort((a, b) => {
    if (a.slop_score !== b.slop_score) {
      return b.slop_score - a.slop_score
    }
    const timeDiff =
      new Date(b.last_scored_at).getTime() -
      new Date(a.last_scored_at).getTime()
    if (timeDiff !== 0) {
      return timeDiff
    }
    return a.username.localeCompare(b.username)
  })

export const upsertLeaderboardEntry = async (
  entry: LeaderboardEntry,
  options: LeaderboardStoreOptions = {},
): Promise<LeaderboardEntry | null> => {
  const redis = getCommandClient()
  if (!redis) {
    console.warn('Redis unavailable, skipping leaderboard update')
    return null
  }

  const now = options.now ?? new Date()
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  const minInterval =
    options.minUpdateIntervalMinutes ?? DEFAULT_MIN_UPDATE_INTERVAL_MINUTES
  const normalized = entry.username.toLowerCase()
  const updatedEntry: LeaderboardEntry = {
    ...entry,
    last_scored_at: now.toISOString(),
  }

  // Optimistic concurrency: retry loop with WATCH/MULTI/EXEC
  const MAX_RETRIES = 10
  let lastError: unknown = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Watch the key for changes
      await redis.watch(LEADERBOARD_KEY)

      // Read current state
      const raw = await redis.get(LEADERBOARD_KEY)
      let state: LeaderboardState = { entries: [] }
      if (raw) {
        const parsed = JSON.parse(raw) as LeaderboardState
        if (parsed && Array.isArray(parsed.entries)) {
          state = parsed
        }
      }

      // Find existing entry
      const existingIndex = state.entries.findIndex(
        (item) => item.username.toLowerCase() === normalized,
      )

      // Check min interval for updates
      if (existingIndex >= 0) {
        const existing = state.entries[existingIndex]
        const last = new Date(existing.last_scored_at)
        const diffMinutes = (now.getTime() - last.getTime()) / (1000 * 60)
        if (!Number.isNaN(diffMinutes) && diffMinutes < minInterval) {
          await redis.unwatch()
          return null
        }
      }

      // Apply update
      if (existingIndex >= 0) {
        state.entries[existingIndex] = updatedEntry
      } else {
        state.entries.push(updatedEntry)
      }

      // Sort and trim
      const trimmed = sortEntries(state.entries).slice(0, maxEntries)

      // Execute transaction
      const result = await redis
        .multi()
        .set(LEADERBOARD_KEY, JSON.stringify({ entries: trimmed }))
        .exec()

      if (result === null) {
        // Transaction failed due to watch (key changed), retry
        continue
      }

      // Increment unique counter for new users (outside transaction — at-most-once is fine)
      if (existingIndex < 0) {
        try {
          await redis.incr(UNIQUE_COUNT_KEY)
        } catch {
          // Non-critical — counter is best-effort
        }
      }

      // Success
      return updatedEntry
    } catch (err: unknown) {
      lastError = err
      console.warn(
        `Leaderboard upsert attempt ${attempt + 1} failed:`,
        err instanceof Error ? err.message : String(err),
      )
      try {
        await redis.unwatch()
      } catch {
        // ignore
      }
      if (attempt < MAX_RETRIES - 1) {
        // Exponential backoff with jitter
        const delayMs =
          Math.min(50 * 2 ** attempt, 500) + Math.floor(Math.random() * 50)
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }

  console.error('Leaderboard upsert failed after max retries:', lastError)
  return null
}

export const getLeaderboard = async (options: LeaderboardStoreOptions = {}) => {
  const limit = options.limit ?? DEFAULT_LIMIT
  const confidenceFloor = options.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR
  const state = await loadState()
  const filtered = sortEntries([...state.entries]).filter(
    (entry) =>
      confidenceRank[entry.confidence] >= confidenceRank[confidenceFloor],
  )

  let totalAnalyzed = state.entries.length
  const redis = getCommandClient()
  if (redis) {
    try {
      const count = await redis.get(UNIQUE_COUNT_KEY)
      if (count !== null) {
        const parsed = parseInt(count, 10)
        if (!Number.isNaN(parsed) && parsed > 0) {
          totalAnalyzed = parsed
        }
      }
    } catch {
      // Fall back to state.entries.length
    }
  }

  return {
    entries: filtered.slice(0, limit),
    total_analyzed: totalAnalyzed,
    updated_at:
      filtered[0]?.last_scored_at ?? state.entries[0]?.last_scored_at ?? null,
  }
}

// For testing: allow injecting a Redis client directly
export const _testInjectRedisClient = (client: Redis | null): void => {
  commandClient = client
}

// For testing: reset internal state
export const _testResetClient = (): void => {
  commandClient = null
}
