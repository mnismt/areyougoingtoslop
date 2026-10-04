import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { type AppEnv, setEnv } from '../env'
import { createFakeEnv } from '../testing/fake-env'
import {
  getGitHubQueueSnapshot,
  SCORE_QUEUE_MAX_CONCURRENCY,
} from './github-queue-observer'

const seed = async (
  env: AppEnv,
  rows: Array<[jobId: string, user: string, status: string, ageMs: number]>,
) => {
  const now = Date.now()
  for (const [jobId, user, status, ageMs] of rows) {
    await env.DB.prepare(
      'INSERT INTO score_jobs (job_id, username_key, status, snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(jobId, user, status, '{}', now - ageMs, now - ageMs)
      .run()
  }
}

describe('getGitHubQueueSnapshot', () => {
  afterEach(() => setEnv(null))

  it('is disabled without bindings', async () => {
    const snapshot = await getGitHubQueueSnapshot()
    assert.equal(snapshot.enabled, false)
    assert.equal(snapshot.health, 'disabled')
    assert.equal(snapshot.queue.workers_configured, SCORE_QUEUE_MAX_CONCURRENCY)
    assert.deepEqual(snapshot.consumers, [])
    assert.equal(snapshot.warnings.length > 0, true)
  })

  it('derives queue stats from score_jobs', async () => {
    const { env } = createFakeEnv()
    setEnv(env)
    await seed(env, [
      ['aaaaaaaa-1', 'alice', 'running', 3_000],
      ['bbbbbbbb-2', 'bob', 'queued', 1_000],
      ['cccccccc-3', 'carol', 'queued', 2_000],
      ['dddddddd-4', 'dave', 'completed', 5_000],
      ['eeeeeeee-5', 'dave', 'completed', 6_000],
      ['ffffffff-6', 'erin', 'failed', 7_000],
      ['gggggggg-7', 'old', 'completed', 60 * 60 * 1000],
      // Dead: running past the 15-minute stale cutoff. Must not count as a consumer.
      ['hhhhhhhh-8', 'zombie', 'running', 20 * 60 * 1000],
      // Still a live backlog entry: queued rows get a much larger allowance.
      ['iiiiiiii-9', 'patient', 'queued', 20 * 60 * 1000],
    ])

    const snapshot = await getGitHubQueueSnapshot()
    assert.equal(snapshot.enabled, true)
    assert.equal(snapshot.health, 'ok')
    assert.equal(snapshot.queue.workers_configured, 4)
    assert.equal(snapshot.queue.stream_initialized, true)
    assert.equal(snapshot.queue.lag, 3)
    assert.equal(snapshot.queue.pending, 1)
    assert.equal(snapshot.queue.delayed, 0)
    assert.equal(snapshot.queue.active_consumers, 1)
    assert.equal(snapshot.queue.online_consumers, 1)
    assert.equal(snapshot.queue.known_consumers, 1)
    assert.equal(snapshot.queue.processed_entries, 3)
    assert.equal(snapshot.queue.next_retry_at, null)
    assert.equal(snapshot.consumers.length, 1)
    assert.equal(snapshot.consumers[0]?.name, 'job-aaaaaaaa')
    assert.equal(snapshot.consumers[0]?.pending, 1)
    assert.deepEqual(snapshot.consumers[0]?.current_usernames, ['alice'])
    assert.ok((snapshot.consumers[0]?.idle_ms ?? 0) >= 3_000)
    assert.deepEqual(snapshot.active_score_usernames, [
      'alice',
      'bob',
      'carol',
      'patient',
    ])
    assert.deepEqual(snapshot.recent_usernames, ['dave'])
  })

  it('is degraded when D1 fails', async () => {
    const { env } = createFakeEnv()
    setEnv({
      ...env,
      DB: {
        ...env.DB,
        prepare: () => {
          throw new Error('d1 down')
        },
      },
    })
    const snapshot = await getGitHubQueueSnapshot()
    assert.equal(snapshot.enabled, true)
    assert.equal(snapshot.health, 'degraded')
    assert.equal(snapshot.warnings.length, 1)
  })
})
