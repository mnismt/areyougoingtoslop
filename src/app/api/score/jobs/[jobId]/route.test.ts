import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { setEnv } from '../../../../../server/env'
import { createFakeEnv } from '../../../../../server/testing/fake-env'
import { GET } from './route'

const get = (jobId: string) =>
  GET(new Request('http://localhost'), {
    params: Promise.resolve({ jobId }),
  })

describe('score job by id route', () => {
  let fake: ReturnType<typeof createFakeEnv>
  beforeEach(() => {
    fake = createFakeEnv()
    setEnv(fake.env)
  })
  afterEach(() => setEnv(null))

  it('returns job_not_found when no snapshot exists', async () => {
    const response = await get('missing-job-id')
    assert.equal(response.status, 404)
    const body = await response.json()
    assert.equal(body.error, 'job_not_found')
  })

  it('returns a known job with no-store', async () => {
    const now = Date.now()
    const snapshot = { job_id: 'job-1', username: 'octocat', status: 'queued' }
    await fake.env.DB.prepare(
      'INSERT INTO score_jobs (job_id, username_key, status, snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind('job-1', 'octocat', 'queued', JSON.stringify(snapshot), now, now)
      .run()

    const response = await get('job-1')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), snapshot)
  })
})
