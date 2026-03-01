import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import Redis from 'ioredis'
import {
  _testInjectRedisClient,
  _testResetClient,
  getLeaderboard,
  upsertLeaderboardEntry,
} from './store'

describe('leaderboard store', () => {
  let redis: Redis
  let testKey: string

  const TEST_REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

  before(async () => {
    redis = new Redis(TEST_REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })
    await redis.ping() // Verify connection
  })

  after(async () => {
    await redis.quit()
    _testResetClient()
  })

  beforeEach(async () => {
    // Generate isolated test key
    testKey = `ays:leaderboard:test:${randomUUID()}`
    // Inject the test key into the store module by monkey-patching
    // We'll set the key directly in Redis and the store should read it
    await redis.set(testKey, JSON.stringify({ entries: [] }))
  })

  afterEach(async () => {
    // Clean up test key
    await redis.del(testKey)
  })

  it('stores and retrieves entries', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')

    // Inject Redis client and override key
    const originalKey = 'ays:leaderboard:v1:state'
    await redis.rename(testKey, originalKey)
    _testInjectRedisClient(redis)

    await upsertLeaderboardEntry(
      {
        username: 'octocat',
        slop_score: 72,
        tier: 'the delegation economy',
        confidence: 'high',
        last_scored_at: now.toISOString(),
      },
      { now },
    )

    const leaderboard = await getLeaderboard({})
    assert.equal(leaderboard.entries.length, 1)
    assert.equal(leaderboard.entries[0].username, 'octocat')
    assert.equal(leaderboard.entries[0].slop_score, 72)

    // Clean up
    await redis.del(originalKey)
    _testResetClient()
  })

  it('filters by confidence floor', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')

    // Inject Redis client and override key
    const originalKey = 'ays:leaderboard:v1:state'
    await redis.rename(testKey, originalKey)
    _testInjectRedisClient(redis)

    await upsertLeaderboardEntry(
      {
        username: 'low-signal',
        slop_score: 18,
        tier: 'the tab-key athlete',
        confidence: 'low',
        last_scored_at: now.toISOString(),
      },
      { now },
    )

    await upsertLeaderboardEntry(
      {
        username: 'medium-signal',
        slop_score: 44,
        tier: 'the context window regular',
        confidence: 'medium',
        last_scored_at: now.toISOString(),
      },
      { now },
    )

    const leaderboard = await getLeaderboard({})
    assert.equal(leaderboard.entries.length, 1)
    assert.equal(leaderboard.entries[0].username, 'medium-signal')

    // Clean up
    await redis.del(originalKey)
    _testResetClient()
  })

  it('skips rapid repeat updates', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    const later = new Date('2026-02-23T00:05:00.000Z')

    // Inject Redis client and override key
    const originalKey = 'ays:leaderboard:v1:state'
    await redis.rename(testKey, originalKey)
    _testInjectRedisClient(redis)

    await upsertLeaderboardEntry(
      {
        username: 'repeat',
        slop_score: 30,
        tier: 'the prompt-curious',
        confidence: 'medium',
        last_scored_at: now.toISOString(),
      },
      { now, minUpdateIntervalMinutes: 10 },
    )

    const skipped = await upsertLeaderboardEntry(
      {
        username: 'repeat',
        slop_score: 60,
        tier: 'the context window regular',
        confidence: 'medium',
        last_scored_at: later.toISOString(),
      },
      { now: later, minUpdateIntervalMinutes: 10 },
    )

    assert.equal(skipped, null)
    const leaderboard = await getLeaderboard({
      confidenceFloor: 'low',
    })
    assert.equal(leaderboard.entries[0].slop_score, 30)

    // Clean up
    await redis.del(originalKey)
    _testResetClient()
  })

  it('returns empty leaderboard when Redis is unavailable', async () => {
    // Inject null client to simulate Redis unavailability
    _testInjectRedisClient(null)

    const leaderboard = await getLeaderboard({})
    assert.equal(leaderboard.entries.length, 0)
    assert.equal(leaderboard.updated_at, null)

    _testResetClient()
  })

  it('sorts entries by score desc, then date desc, then username asc', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    const earlier = new Date('2026-02-22T00:00:00.000Z')

    // Inject Redis client and override key
    const originalKey = 'ays:leaderboard:v1:state'
    await redis.rename(testKey, originalKey)
    _testInjectRedisClient(redis)

    // Add entries with different scores and dates
    await upsertLeaderboardEntry(
      {
        username: 'alice',
        slop_score: 50,
        tier: 'the context window regular',
        confidence: 'medium',
        last_scored_at: now.toISOString(),
      },
      { now },
    )

    await upsertLeaderboardEntry(
      {
        username: 'bob',
        slop_score: 60,
        tier: 'the delegation economy',
        confidence: 'medium',
        last_scored_at: now.toISOString(),
      },
      { now },
    )

    await upsertLeaderboardEntry(
      {
        username: 'charlie',
        slop_score: 50,
        tier: 'the context window regular',
        confidence: 'medium',
        last_scored_at: earlier.toISOString(),
      },
      { now: earlier },
    )

    await upsertLeaderboardEntry(
      {
        username: 'dave',
        slop_score: 50,
        tier: 'the context window regular',
        confidence: 'medium',
        last_scored_at: now.toISOString(),
      },
      { now },
    )

    const leaderboard = await getLeaderboard({})
    assert.equal(leaderboard.entries.length, 4)

    // bob has highest score (60)
    assert.equal(leaderboard.entries[0].username, 'bob')

    // alice and dave have same score (50) and date, alice comes first alphabetically
    assert.equal(leaderboard.entries[1].username, 'alice')
    assert.equal(leaderboard.entries[2].username, 'dave')

    // charlie has same score (50) but earlier date
    assert.equal(leaderboard.entries[3].username, 'charlie')

    // Clean up
    await redis.del(originalKey)
    _testResetClient()
  })
})
