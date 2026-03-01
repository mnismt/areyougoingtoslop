import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clearScoreCache, setCachedScore } from '../cache'
import {
  clearScoreJobs,
  createOrAttachScoreJob,
  getScoreJob,
} from './score-jobs'

describe('score jobs', () => {
  it('rejects invalid usernames', async () => {
    await clearScoreJobs()

    const result = await createOrAttachScoreJob('bad--name')
    assert.equal(result.ok, false)
    if (result.ok) {
      throw new Error('Expected invalid username job creation to fail')
    }
    assert.equal(result.error.code, 'invalid_username')
  })

  it('returns null for unknown job ids', async () => {
    await clearScoreJobs()
    assert.equal(await getScoreJob('missing-job-id'), null)
  })

  it('creates immediate completed snapshot from cached score', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const now = new Date()
    setCachedScore(
      'octocat',
      {
        slop_score: 33,
        tier: 'The Tab-Key Athlete',
        confidence: 'medium',
        top_signals: ['Commit messages mention AI tools'],
        scoring_window: 'last 180 days',
        analyzed_commits: [
          {
            sha: 'abc1234',
            repo: 'octo/repo',
            message: 'feat: ship it',
            occurred_at: '2026-02-20T00:00:00.000Z',
            additions: 20,
            deletions: 3,
            flags: ['ai_keyword'],
          },
        ],
      },
      now,
      60_000,
    )

    const result = await createOrAttachScoreJob('octocat')
    assert.equal(result.ok, true)
    if (!result.ok) {
      throw new Error('Expected cached score job creation to succeed')
    }

    assert.equal(result.snapshot.status, 'completed')
    assert.equal(result.snapshot.progress_percent, 100)
    assert.equal(result.snapshot.result?.slop_score, 33)
    assert.equal(result.snapshot.coverage.commits_discovered, 1)
    assert.equal(result.snapshot.coverage.commits_enriched, 1)

    clearScoreCache()
  })
})

describe('createOrAttachScoreJob dedup', () => {
  it('returns existing active job for same username', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const now = new Date()
    setCachedScore(
      'dedup-user',
      {
        slop_score: 50,
        tier: 'The Tab-Key Athlete',
        confidence: 'medium',
        top_signals: ['test signal'],
        scoring_window: 'last 180 days',
        analyzed_commits: [],
      },
      now,
      60_000,
    )

    const first = await createOrAttachScoreJob('dedup-user')
    const second = await createOrAttachScoreJob('dedup-user')

    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    if (!first.ok || !second.ok) throw new Error('Expected both to succeed')

    assert.equal(first.snapshot.status, 'completed')
    assert.equal(second.snapshot.status, 'completed')
    assert.equal(first.snapshot.result?.slop_score, 50)
    assert.equal(second.snapshot.result?.slop_score, 50)
  })
})

describe('createOrAttachScoreJob username handling', () => {
  it('trims whitespace-padded username', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const now = new Date()
    setCachedScore(
      'octocat',
      {
        slop_score: 20,
        tier: 'Artisanal Organic Code',
        confidence: 'low',
        top_signals: [],
        scoring_window: 'last 180 days',
        analyzed_commits: [],
      },
      now,
      60_000,
    )

    const result = await createOrAttachScoreJob('  octocat  ')
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('Expected success')
    assert.equal(result.snapshot.username, 'octocat')
    assert.equal(result.snapshot.status, 'completed')
  })

  it('rejects empty string', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const result = await createOrAttachScoreJob('')
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('Expected failure')
    assert.equal(result.error.code, 'invalid_username')
  })

  it('rejects username with spaces', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const result = await createOrAttachScoreJob('bad name')
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('Expected failure')
    assert.equal(result.error.code, 'invalid_username')
  })

  it('rejects username ending with hyphen', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const result = await createOrAttachScoreJob('trailing-')
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('Expected failure')
    assert.equal(result.error.code, 'invalid_username')
  })
})

describe('getScoreJob retrieval', () => {
  it('retrieves a previously created job by id', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const now = new Date()
    setCachedScore(
      'retrieve-user',
      {
        slop_score: 25,
        tier: 'The Tab-Key Athlete',
        confidence: 'low',
        top_signals: [],
        scoring_window: 'last 180 days',
        analyzed_commits: [],
      },
      now,
      60_000,
    )

    const result = await createOrAttachScoreJob('retrieve-user')
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('Expected success')

    const retrieved = await getScoreJob(result.snapshot.job_id)
    assert.ok(retrieved)
    assert.equal(retrieved.job_id, result.snapshot.job_id)
    assert.equal(retrieved.username, 'retrieve-user')
    assert.equal(retrieved.status, 'completed')
    assert.equal(retrieved.result?.slop_score, 25)
  })

  it('returns null for non-existent id after creating other jobs', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const now = new Date()
    setCachedScore(
      'other-user',
      {
        slop_score: 10,
        tier: 'Artisanal Organic Code',
        confidence: 'low',
        top_signals: [],
        scoring_window: 'last 180 days',
        analyzed_commits: [],
      },
      now,
      60_000,
    )

    await createOrAttachScoreJob('other-user')
    assert.equal(await getScoreJob('non-existent-id'), null)
  })
})

describe('snapshot shape', () => {
  it('snapshot contains all required fields', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const now = new Date()
    setCachedScore(
      'shape-user',
      {
        slop_score: 40,
        tier: 'The Tab-Key Athlete',
        confidence: 'medium',
        top_signals: ['signal1'],
        scoring_window: 'last 180 days',
        analyzed_commits: [
          {
            sha: 'def456',
            repo: 'test/repo',
            message: 'fix: thing',
            occurred_at: '2026-02-01T00:00:00.000Z',
            flags: [],
          },
        ],
      },
      now,
      60_000,
    )

    const result = await createOrAttachScoreJob('shape-user')
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('Expected success')

    const s = result.snapshot
    assert.equal(typeof s.job_id, 'string')
    assert.equal(typeof s.username, 'string')
    assert.equal(typeof s.status, 'string')
    assert.equal(typeof s.stage, 'string')
    assert.equal(typeof s.progress_percent, 'number')
    assert.ok(s.result !== undefined)
    assert.equal(typeof s.coverage, 'object')
    assert.equal(typeof s.limits, 'object')
    assert.equal(typeof s.created_at, 'string')
    assert.equal(typeof s.updated_at, 'string')
    assert.equal(s.error, null)
    assert.equal(typeof s.coverage.commits_discovered, 'number')
    assert.equal(typeof s.coverage.commits_enriched, 'number')
    assert.equal(typeof s.coverage.is_partial, 'boolean')
    assert.equal(typeof s.limits.rate_limited, 'boolean')
    assert.equal(typeof s.limits.events_pagination_limited, 'boolean')
  })
})

describe('coverage computation from cache', () => {
  it('counts enriched commits based on additions/deletions presence', async () => {
    await clearScoreJobs()
    clearScoreCache()

    const now = new Date()
    setCachedScore(
      'coverage-user',
      {
        slop_score: 60,
        tier: 'The Copilot Whisperer',
        confidence: 'high',
        top_signals: [],
        scoring_window: 'last 180 days',
        analyzed_commits: [
          {
            sha: 'a1',
            repo: 'r/1',
            message: 'msg1',
            occurred_at: '2026-01-01T00:00:00Z',
            additions: 10,
            deletions: 5,
            flags: [],
          },
          {
            sha: 'a2',
            repo: 'r/2',
            message: 'msg2',
            occurred_at: '2026-01-02T00:00:00Z',
            flags: [],
          },
          {
            sha: 'a3',
            repo: 'r/3',
            message: 'msg3',
            occurred_at: '2026-01-03T00:00:00Z',
            additions: 0,
            flags: [],
          },
        ],
      },
      now,
      60_000,
    )

    const result = await createOrAttachScoreJob('coverage-user')
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('Expected success')

    assert.equal(result.snapshot.coverage.commits_discovered, 3)
    assert.equal(result.snapshot.coverage.commits_enriched, 2)
  })
})

describe('clearScoreJobs', () => {
  it('clears all jobs from runtime state', async () => {
    const previousRedisUrl = process.env.REDIS_URL
    process.env.REDIS_URL = ''

    try {
      clearScoreCache()
      const now = new Date()
      setCachedScore(
        'clear-user',
        {
          slop_score: 10,
          tier: 'Artisanal Organic Code',
          confidence: 'low',
          top_signals: [],
          scoring_window: 'last 180 days',
          analyzed_commits: [],
        },
        now,
        60_000,
      )

      const result = await createOrAttachScoreJob('clear-user')
      assert.equal(result.ok, true)
      if (!result.ok) throw new Error('Expected success')

      const jobId = result.snapshot.job_id
      assert.ok(await getScoreJob(jobId))

      await clearScoreJobs()
      assert.equal(await getScoreJob(jobId), null)
    } finally {
      process.env.REDIS_URL = previousRedisUrl
    }
  })
})
