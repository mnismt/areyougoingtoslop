import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { setEnv } from '../env'
import { createFakeEnv } from '../testing/fake-env'
import { checkRateLimit } from '.'

const opts = { windowMs: 60_000, maxRequests: 3 }
const t0 = 1_000_000_020_000

describe('checkRateLimit (D1, window starts at first request)', () => {
  beforeEach(() => setEnv(createFakeEnv().env))
  afterEach(() => setEnv(null))

  it('allows maxRequests then blocks the next one', async () => {
    const results = []
    for (let i = 0; i < 4; i += 1) {
      results.push(await checkRateLimit('a', opts, t0 + i))
    }
    assert.deepEqual(
      results.map((r) => [r.allowed, r.remaining]),
      [
        [true, 2],
        [true, 1],
        [true, 0],
        [false, 0],
      ],
    )
    assert.equal(results[3].resetAt, t0 + 60_000)
  })

  it('resets one full window after the first request', async () => {
    for (let i = 0; i < 4; i += 1) await checkRateLimit('a', opts, t0)
    assert.equal((await checkRateLimit('a', opts, t0 + 59_999)).allowed, false)
    const next = await checkRateLimit('a', opts, t0 + 60_000)
    assert.equal(next.allowed, true)
    assert.equal(next.remaining, 2)
    assert.equal(next.resetAt, t0 + 120_000)
  })

  it('has no burst across a clock-aligned boundary', async () => {
    // t0 is on a clock minute; a clock-aligned window starting at t1 would reset at t0 + 60s.
    const t1 = t0 + 50_000
    for (let i = 0; i < 3; i += 1) await checkRateLimit('a', opts, t1)
    assert.equal((await checkRateLimit('a', opts, t0 + 60_000)).allowed, false)
  })

  it('isolates keys', async () => {
    for (let i = 0; i < 4; i += 1) await checkRateLimit('a', opts, t0)
    assert.equal((await checkRateLimit('b', opts, t0)).allowed, true)
  })

  it('fails open without bindings', async () => {
    setEnv(null)
    assert.equal((await checkRateLimit('a', opts, t0)).allowed, true)
  })
})
