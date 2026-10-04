import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { type AppEnv, setEnv } from '../../../server/env'
import { createFakeEnv } from '../../../server/testing/fake-env'
import { POST } from './route'

const post = (message: string, ip?: string) =>
  POST(
    new Request('http://localhost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ip ? { 'x-forwarded-for': ip } : {}),
      },
      body: JSON.stringify({ message }),
    }),
  )

describe('feedback api', () => {
  let env: AppEnv
  beforeEach(() => {
    env = createFakeEnv().env
    setEnv(env)
  })
  afterEach(() => setEnv(null))

  it('accepts feedback submissions and stores them in D1', async () => {
    const response = await post('  Great roast, keep going.  ', '10.0.0.9')

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), { ok: true })
    const { results } = await env.DB.prepare(
      'SELECT message, ip FROM feedback',
    ).all<{ message: string; ip: string | null }>()
    assert.deepEqual(results, [
      { message: 'Great roast, keep going.', ip: '10.0.0.9' },
    ])
  })

  it('rejects short feedback', async () => {
    const response = await post('hey')
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'invalid_payload',
      message: 'Feedback is too short.',
    })
  })

  it('rejects long feedback', async () => {
    const response = await post('x'.repeat(1001))
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'invalid_payload',
      message: 'Feedback is too long.',
    })
  })

  it('rate limits the 6th submission from the same ip', async () => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal(
        (await post('Great roast, keep going.', '10.0.0.9')).status,
        201,
      )
    }
    const limited = await post('Great roast, keep going.', '10.0.0.9')
    assert.equal(limited.status, 429)
    assert.deepEqual(await limited.json(), {
      error: 'rate_limited',
      message: 'Too many feedback submissions. Try again later.',
    })
    assert.equal(
      (await post('Great roast, keep going.', '10.0.0.10')).status,
      201,
    )
  })

  it('keeps only the newest 200 entries', async () => {
    for (let i = 0; i < 201; i += 1) {
      assert.equal((await post(`feedback number ${i}`)).status, 201)
    }
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM feedback',
    ).first<{ n: number }>()
    assert.equal(row?.n, 200)
    const first = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM feedback WHERE message = ?',
    )
      .bind('feedback number 0')
      .first<{ n: number }>()
    assert.equal(first?.n, 0)
  })
})
