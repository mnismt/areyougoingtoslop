import type Redis from 'ioredis'

const LEADERBOARD_KEY = 'ays:leaderboard:v1:state'
const UNIQUE_COUNT_KEY = 'ays:leaderboard:v1:unique-count'

type LeaderboardState = {
  entries: { username: string }[]
}

export default async function migrate(redis: Redis) {
  const existing = await redis.get(UNIQUE_COUNT_KEY)
  if (existing !== null) {
    return { skipped: true, reason: `counter already exists: ${existing}` }
  }

  const raw = await redis.get(LEADERBOARD_KEY)
  if (!raw) {
    await redis.setnx(UNIQUE_COUNT_KEY, '0')
    return { skipped: false, result: 'no leaderboard state, seeded to 0' }
  }

  const state = JSON.parse(raw) as LeaderboardState
  const count = Array.isArray(state.entries) ? state.entries.length : 0
  const set = await redis.setnx(UNIQUE_COUNT_KEY, String(count))

  if (set === 1) {
    return { skipped: false, result: `seeded to ${count}` }
  }
  return { skipped: true, reason: 'set by another process' }
}
