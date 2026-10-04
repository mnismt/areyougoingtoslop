import { getEnv } from '../env'
import type { LeaderboardEntry } from './types'

export type LeaderboardStoreOptions = {
  now?: Date
  maxEntries?: number
  minUpdateIntervalMinutes?: number
  confidenceFloor?: 'low' | 'medium' | 'high'
  limit?: number
}

type LeaderboardRow = {
  username: string
  slop_score: number
  tier: string
  tier_tagline: string | null
  confidence: LeaderboardEntry['confidence']
  last_scored_at: string
}

const DEFAULT_MAX_ENTRIES = 200
const DEFAULT_MIN_UPDATE_INTERVAL_MINUTES = 10
const DEFAULT_LIMIT = 50
const DEFAULT_CONFIDENCE_FLOOR: LeaderboardStoreOptions['confidenceFloor'] =
  'medium'

const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const
const UNIQUE_COUNTER = 'leaderboard_unique'
const RANK_ORDER =
  'ORDER BY slop_score DESC, last_scored_at DESC, username COLLATE NOCASE ASC'

const toEntry = ({ tier_tagline, ...row }: LeaderboardRow): LeaderboardEntry =>
  tier_tagline == null ? row : { ...row, tier_tagline }

export const upsertLeaderboardEntry = async (
  entry: LeaderboardEntry,
  options: LeaderboardStoreOptions = {},
): Promise<LeaderboardEntry | null> => {
  const now = options.now ?? new Date()
  const minInterval =
    options.minUpdateIntervalMinutes ?? DEFAULT_MIN_UPDATE_INTERVAL_MINUTES
  const key = entry.username.toLowerCase()
  const updatedEntry: LeaderboardEntry = {
    ...entry,
    last_scored_at: now.toISOString(),
  }

  try {
    const db = getEnv().DB
    const existing = await db
      .prepare('SELECT last_scored_at FROM leaderboard WHERE username_key = ?')
      .bind(key)
      .first<{ last_scored_at: string }>()
    if (existing) {
      const diffMinutes =
        (now.getTime() - new Date(existing.last_scored_at).getTime()) / 60_000
      if (!Number.isNaN(diffMinutes) && diffMinutes < minInterval) {
        return null
      }
    }

    // One transaction: bump the unique counter only if the row is new, then upsert.
    await db.batch([
      db
        .prepare(
          `INSERT INTO counters (name, value)
           SELECT ?, 1 WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE username_key = ?)
           ON CONFLICT(name) DO UPDATE SET value = value + 1`,
        )
        .bind(UNIQUE_COUNTER, key),
      db
        .prepare(
          `INSERT INTO leaderboard (username_key, username, slop_score, tier, tier_tagline, confidence, last_scored_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(username_key) DO UPDATE SET
             username = excluded.username,
             slop_score = excluded.slop_score,
             tier = excluded.tier,
             tier_tagline = excluded.tier_tagline,
             confidence = excluded.confidence,
             last_scored_at = excluded.last_scored_at`,
        )
        .bind(
          key,
          updatedEntry.username,
          updatedEntry.slop_score,
          updatedEntry.tier,
          updatedEntry.tier_tagline ?? null,
          updatedEntry.confidence,
          updatedEntry.last_scored_at,
        ),
    ])
    return updatedEntry
  } catch (err: unknown) {
    console.warn('Leaderboard upsert failed:', err)
    return null
  }
}

export const getLeaderboard = async (options: LeaderboardStoreOptions = {}) => {
  const limit = Math.min(
    options.limit ?? DEFAULT_LIMIT,
    options.maxEntries ?? DEFAULT_MAX_ENTRIES,
  )
  const confidenceFloor = options.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR
  const levels = CONFIDENCE_LEVELS.slice(
    CONFIDENCE_LEVELS.indexOf(confidenceFloor ?? 'medium'),
  )

  try {
    const db = getEnv().DB
    const [{ results }, stats] = await Promise.all([
      db
        .prepare(
          `SELECT username, slop_score, tier, tier_tagline, confidence, last_scored_at
           FROM leaderboard WHERE confidence IN (${levels.map(() => '?').join(', ')})
           ${RANK_ORDER} LIMIT ?`,
        )
        .bind(...levels, limit)
        .all<LeaderboardRow>(),
      db
        .prepare(
          `SELECT
             (SELECT value FROM counters WHERE name = ?) AS unique_count,
             (SELECT COUNT(*) FROM leaderboard) AS row_count,
             (SELECT last_scored_at FROM leaderboard ${RANK_ORDER} LIMIT 1) AS top_scored_at`,
        )
        .bind(UNIQUE_COUNTER)
        .first<{
          unique_count: number | null
          row_count: number
          top_scored_at: string | null
        }>(),
    ])
    const entries = results.map(toEntry)
    const uniqueCount = Number(stats?.unique_count ?? 0)

    return {
      entries,
      total_analyzed:
        uniqueCount > 0 ? uniqueCount : Number(stats?.row_count ?? 0),
      updated_at: entries[0]?.last_scored_at ?? stats?.top_scored_at ?? null,
    }
  } catch (err: unknown) {
    console.warn('Failed to load leaderboard from D1:', err)
    return { entries: [], total_analyzed: 0, updated_at: null }
  }
}
