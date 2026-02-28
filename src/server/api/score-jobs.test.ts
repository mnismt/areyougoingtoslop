import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clearScoreCache, setCachedScore } from '../cache'
import {
  clearScoreJobs,
  createOrAttachScoreJob,
  getScoreJob,
} from './score-jobs'

describe('score jobs', () => {
  it('rejects invalid usernames', () => {
    clearScoreJobs()

    const result = createOrAttachScoreJob('bad--name')
    assert.equal(result.ok, false)
    if (result.ok) {
      throw new Error('Expected invalid username job creation to fail')
    }
    assert.equal(result.error.code, 'invalid_username')
  })

  it('returns null for unknown job ids', () => {
    clearScoreJobs()
    assert.equal(getScoreJob('missing-job-id'), null)
  })

  it('creates immediate completed snapshot from cached score', () => {
    clearScoreJobs()
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

    const result = createOrAttachScoreJob('octocat')
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
