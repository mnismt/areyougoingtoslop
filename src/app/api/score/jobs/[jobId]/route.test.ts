import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clearScoreJobs } from '../../../../../server/api/score-jobs'
import { GET } from './route'

describe('score job by id route', () => {
  it('returns job_not_found when no snapshot exists', async () => {
    await clearScoreJobs()

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'missing-job-id' }),
    })

    assert.equal(response.status, 404)
    const body = await response.json()
    assert.equal(body.error, 'job_not_found')
  })
})
