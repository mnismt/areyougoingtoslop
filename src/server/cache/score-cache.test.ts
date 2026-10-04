import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { type AppEnv, setEnv } from '../env'
import type { SlopScoreResult } from '../scoring'
import { createFakeEnv } from '../testing/fake-env'
import { getCachedScore, setCachedScore } from './score-cache'

const score: SlopScoreResult = {
  slop_score: 42,
  tier: 'the context window regular',
  tier_tagline: 'tagline',
  confidence: 'medium',
  top_signals: [],
  scoring_window: 'last 180 days',
  analyzed_commits: [],
}

const now = new Date('2026-03-01T00:00:00.000Z')

describe('score-cache (KV)', () => {
  let env: AppEnv
  beforeEach(() => {
    env = createFakeEnv().env
    setEnv(env)
  })
  afterEach(() => setEnv(null))

  it('round trips a score', async () => {
    assert.equal(await getCachedScore('octocat', now), null)
    await setCachedScore('octocat', score, now, 60_000)
    assert.deepEqual(await getCachedScore('octocat', now), score)
  })

  it('is case-insensitive on the key', async () => {
    await setCachedScore('OctoCat', score, now, 60_000)
    assert.deepEqual(await getCachedScore('OCTOCAT', now), score)
    assert.ok(await env.CACHE.get('score:v1:octocat', 'json'))
  })

  it('treats entries past expiresAt as a miss', async () => {
    await setCachedScore('octocat', score, now, 60_000)
    const later = new Date(now.getTime() + 60_000)
    assert.equal(await getCachedScore('octocat', later), null)
  })

  it('clamps expirationTtl to the KV minimum of 60s', async () => {
    let ttl: number | undefined
    const put = env.CACHE.put
    env.CACHE.put = (key, value, options) => {
      ttl = options?.expirationTtl
      return put(key, value, options)
    }
    await setCachedScore('octocat', score, now, 1_000)
    assert.equal(ttl, 60)
    await setCachedScore('octocat', score, now, 12 * 60 * 60 * 1000)
    assert.equal(ttl, 43_200)
  })

  it('degrades to a miss when bindings are unavailable', async () => {
    setEnv(null)
    await setCachedScore('octocat', score, now, 60_000)
    assert.equal(await getCachedScore('octocat', now), null)
  })
})
