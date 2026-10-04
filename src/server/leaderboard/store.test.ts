import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { type AppEnv, setEnv } from '../env'
import { createFakeEnv } from '../testing/fake-env'
import { getLeaderboard, upsertLeaderboardEntry } from './store'

const counterValue = async (env: AppEnv) =>
  (
    await env.DB.prepare(
      "SELECT value FROM counters WHERE name = 'leaderboard_unique'",
    ).first<{ value: number }>()
  )?.value ?? null

describe('leaderboard store (D1)', () => {
  let env: AppEnv
  beforeEach(() => {
    env = createFakeEnv().env
    setEnv(env)
  })
  afterEach(() => setEnv(null))

  it('stores and retrieves entries', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    const stored = await upsertLeaderboardEntry(
      {
        username: 'octocat',
        slop_score: 72,
        tier: 'the delegation economy',
        tier_tagline: 'outsourcing, but make it git.',
        confidence: 'high',
        last_scored_at: now.toISOString(),
      },
      { now },
    )
    assert.equal(stored?.username, 'octocat')

    const leaderboard = await getLeaderboard({})
    assert.equal(leaderboard.entries.length, 1)
    assert.deepEqual(leaderboard.entries[0], {
      username: 'octocat',
      slop_score: 72,
      tier: 'the delegation economy',
      tier_tagline: 'outsourcing, but make it git.',
      confidence: 'high',
      last_scored_at: now.toISOString(),
    })
    assert.equal(leaderboard.updated_at, now.toISOString())
  })

  it('omits tier_tagline when absent', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    await upsertLeaderboardEntry(
      {
        username: 'plain',
        slop_score: 40,
        tier: 'the prompt-curious',
        confidence: 'medium',
        last_scored_at: now.toISOString(),
      },
      { now },
    )
    const leaderboard = await getLeaderboard({})
    assert.equal('tier_tagline' in leaderboard.entries[0], false)
  })

  it('filters by confidence floor', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
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

    const all = await getLeaderboard({ confidenceFloor: 'low' })
    assert.equal(all.entries.length, 2)
    const high = await getLeaderboard({ confidenceFloor: 'high' })
    assert.equal(high.entries.length, 0)
  })

  it('skips rapid repeat updates', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    const later = new Date('2026-02-23T00:05:00.000Z')

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
        username: 'Repeat',
        slop_score: 60,
        tier: 'the context window regular',
        confidence: 'medium',
        last_scored_at: later.toISOString(),
      },
      { now: later, minUpdateIntervalMinutes: 10 },
    )

    assert.equal(skipped, null)
    const leaderboard = await getLeaderboard({ confidenceFloor: 'low' })
    assert.equal(leaderboard.entries[0].slop_score, 30)
  })

  it('returns empty leaderboard when D1 is unavailable', async () => {
    setEnv(null)
    const leaderboard = await getLeaderboard({})
    assert.deepEqual(leaderboard, {
      entries: [],
      total_analyzed: 0,
      updated_at: null,
    })
    assert.equal(
      await upsertLeaderboardEntry({
        username: 'nobody',
        slop_score: 1,
        tier: 't',
        confidence: 'low',
        last_scored_at: new Date().toISOString(),
      }),
      null,
    )
  })

  it('increments unique counter for new users only', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    const later = new Date('2026-02-23T01:00:00.000Z')

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
    assert.equal(await counterValue(env), 1)

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
    assert.equal(await counterValue(env), 2)

    const updated = await upsertLeaderboardEntry(
      {
        username: 'ALICE',
        slop_score: 55,
        tier: 'the context window regular',
        confidence: 'medium',
        last_scored_at: later.toISOString(),
      },
      { now: later, minUpdateIntervalMinutes: 0 },
    )
    assert.equal(updated?.slop_score, 55)
    assert.equal(await counterValue(env), 2)

    const leaderboard = await getLeaderboard({})
    assert.equal(leaderboard.entries.length, 2)
    assert.equal(leaderboard.total_analyzed, 2)
  })

  it('getLeaderboard returns total_analyzed from unique counter', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    await env.DB.prepare(
      "INSERT INTO counters (name, value) VALUES ('leaderboard_unique', 999)",
    ).run()

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

    const leaderboard = await getLeaderboard({ confidenceFloor: 'low' })
    assert.equal(leaderboard.total_analyzed, 1000)
  })

  it('falls back to row count when the counter is missing', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z').toISOString()
    for (const [name, score] of [
      ['alice', 50],
      ['bob', 60],
    ] as const) {
      await env.DB.prepare(
        "INSERT INTO leaderboard VALUES (?, ?, ?, 'tier', NULL, 'low', ?)",
      )
        .bind(name, name, score, now)
        .run()
    }

    const leaderboard = await getLeaderboard({ confidenceFloor: 'medium' })
    assert.equal(leaderboard.entries.length, 0)
    assert.equal(leaderboard.total_analyzed, 2)
    // No filtered entries: updated_at falls back to the top unfiltered row.
    assert.equal(leaderboard.updated_at, now)
  })

  it('sorts entries by score desc, then date desc, then username asc', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    const earlier = new Date('2026-02-22T00:00:00.000Z')

    for (const [username, slop_score, at] of [
      ['alice', 50, now],
      ['bob', 60, now],
      ['charlie', 50, earlier],
      ['dave', 50, now],
    ] as const) {
      await upsertLeaderboardEntry(
        {
          username,
          slop_score,
          tier: 'the context window regular',
          confidence: 'medium',
          last_scored_at: at.toISOString(),
        },
        { now: at },
      )
    }

    const leaderboard = await getLeaderboard({})
    assert.deepEqual(
      leaderboard.entries.map((e) => e.username),
      ['bob', 'alice', 'dave', 'charlie'],
    )

    const limited = await getLeaderboard({ limit: 2 })
    assert.deepEqual(
      limited.entries.map((e) => e.username),
      ['bob', 'alice'],
    )
  })
})
