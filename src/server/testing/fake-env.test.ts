import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createFakeEnv } from './fake-env'

describe('createFakeEnv', () => {
  it('applies migrations', async () => {
    const { env } = createFakeEnv()
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1",
    )
      .bind('score_jobs')
      .all<{ name: string }>()
    assert.deepEqual(results, [{ name: 'score_jobs' }])
  })

  it('INSERT OR IGNORE ... RETURNING yields null on conflict', async () => {
    const { env } = createFakeEnv()
    const insert = (jobId: string) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO score_jobs (job_id, username_key, status, snapshot, created_at, updated_at) VALUES (?1, 'octocat', 'queued', '{}', 1, 1) RETURNING job_id",
      )
        .bind(jobId)
        .first<{ job_id: string }>()
    assert.deepEqual(await insert('a'), { job_id: 'a' })
    assert.equal(await insert('b'), null)
  })

  it('KV rejects expirationTtl below 60 and round-trips json', async () => {
    const { env } = createFakeEnv()
    await assert.rejects(env.CACHE.put('k', '1', { expirationTtl: 59 }))
    await env.CACHE.put('k', JSON.stringify({ a: 1 }), { expirationTtl: 60 })
    assert.deepEqual(await env.CACHE.get('k', 'json'), { a: 1 })
  })
})
