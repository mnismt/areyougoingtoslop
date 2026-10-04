import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { setCachedScore } from '../../../../../server/cache'
import { setEnv } from '../../../../../server/env'
import { createFakeEnv } from '../../../../../server/testing/fake-env'
import { POST } from './route'

const post = (username: string, ip = '10.0.0.8') =>
  POST(
    new Request(`http://localhost/api/score/${username}/jobs`, {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
    }),
    { params: Promise.resolve({ username }) },
  )

const realFetch = globalThis.fetch
let fake: ReturnType<typeof createFakeEnv>

describe('score jobs route', () => {
  beforeEach(() => {
    fake = createFakeEnv()
    setEnv(fake.env)
    // Hermetic GitHub: every /users/<name> is a plain user.
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const match = new URL(String(input)).pathname.match(/^\/users\/([^/]+)$/)
      return Response.json(match ? { login: match[1], type: 'User' } : [])
    }) as typeof fetch
  })
  afterEach(() => {
    setEnv(null)
    globalThis.fetch = realFetch
  })

  it('returns 202 no-store for a queued job and attaches repeat POSTs to it', async () => {
    const first = await post('octocat')
    assert.equal(first.status, 202)
    assert.equal(first.headers.get('cache-control'), 'no-store')
    const body = await first.json()
    assert.equal(body.status, 'queued')
    assert.equal(typeof body.job_id, 'string')

    const second = await post('octocat')
    assert.equal(second.status, 202)
    assert.equal((await second.json()).job_id, body.job_id)
    assert.equal(fake.sent.length, 1)
  })

  it('returns 200 with the result for a cached score', async () => {
    await setCachedScore(
      'cached-user',
      {
        slop_score: 42,
        tier: 'the prompt-curious',
        tier_tagline: 'just a couple of tokens between old you and new you',
        confidence: 'medium',
        top_signals: [],
        scoring_window: 'last 180 days',
        analyzed_commits: [],
      },
      new Date(),
      60_000,
    )
    const response = await post('cached-user')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const body = await response.json()
    assert.equal(body.status, 'completed')
    assert.equal(body.result.slop_score, 42)
    assert.equal(fake.sent.length, 0)
  })

  it('returns 400 invalid_username', async () => {
    const response = await post('bad--name')
    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.error, 'invalid_username')
    assert.equal(typeof body.message, 'string')
  })

  it('rate limits the 11th request from the same ip', async () => {
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await post('bad--name')).status, 400)
    }
    const limited = await post('bad--name')
    assert.equal(limited.status, 429)
    assert.equal((await limited.json()).error, 'rate_limited')
    assert.equal((await post('bad--name', '10.0.0.9')).status, 400)
  })
})
