import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { setCachedScore } from '../cache'
import { setEnv } from '../env'
import { createFakeEnv } from '../testing/fake-env'
import {
  createOrAttachScoreJob,
  failScoreJob,
  getScoreJob,
  processScoreJob,
  QUEUED_STALE_MS,
  STALE_MS,
} from './score-jobs'

const realFetch = globalThis.fetch
let fake: ReturnType<typeof createFakeEnv>

// Hermetic GitHub: /users/<name> is a plain user, every list endpoint is empty.
const stubGitHub = () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const match = url.pathname.match(/^\/users\/([^/]+)$/)
    const body = match ? { login: match[1], type: 'User' } : []
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

beforeEach(() => {
  fake = createFakeEnv()
  setEnv(fake.env)
  stubGitHub()
})

afterEach(() => {
  setEnv(null)
  globalThis.fetch = realFetch
})

describe('score jobs', () => {
  it('rejects invalid usernames', async () => {
    const result = await createOrAttachScoreJob('bad--name')
    assert.equal(result.ok, false)
    if (result.ok) {
      throw new Error('Expected invalid username job creation to fail')
    }
    assert.equal(result.error.code, 'invalid_username')
  })

  it('returns null for unknown job ids', async () => {
    assert.equal(await getScoreJob('missing-job-id'), null)
  })

  it('creates immediate completed snapshot from cached score', async () => {
    const now = new Date()
    await setCachedScore(
      'octocat',
      {
        slop_score: 33,
        tier: 'the prompt-curious',
        tier_tagline: 'just a couple of tokens between old you and new you',
        confidence: 'medium',
        top_signals: ['commit messages mention AI tools'],
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
  })
})

describe('createOrAttachScoreJob dedup', () => {
  it('returns existing active job for same username', async () => {
    const now = new Date()
    await setCachedScore(
      'dedup-user',
      {
        slop_score: 50,
        tier: 'the context window regular',
        tier_tagline: 'you have a system prompt and a ritual',
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
    const now = new Date()
    await setCachedScore(
      'octocat',
      {
        slop_score: 20,
        tier: 'the tab-key athlete',
        tier_tagline: 'autocomplete exists. you choose not to know.',
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
    const result = await createOrAttachScoreJob('')
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('Expected failure')
    assert.equal(result.error.code, 'invalid_username')
  })

  it('rejects username with spaces', async () => {
    const result = await createOrAttachScoreJob('bad name')
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('Expected failure')
    assert.equal(result.error.code, 'invalid_username')
  })

  it('rejects username ending with hyphen', async () => {
    const result = await createOrAttachScoreJob('trailing-')
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('Expected failure')
    assert.equal(result.error.code, 'invalid_username')
  })
})

describe('getScoreJob retrieval', () => {
  it('retrieves a previously created job by id', async () => {
    const now = new Date()
    await setCachedScore(
      'retrieve-user',
      {
        slop_score: 25,
        tier: 'the prompt-curious',
        tier_tagline: 'just a couple of tokens between old you and new you',
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
    const now = new Date()
    await setCachedScore(
      'other-user',
      {
        slop_score: 10,
        tier: 'the tab-key athlete',
        tier_tagline: 'autocomplete exists. you choose not to know.',
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
    const now = new Date()
    await setCachedScore(
      'shape-user',
      {
        slop_score: 40,
        tier: 'the prompt-curious',
        tier_tagline: 'just a couple of tokens between old you and new you',
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
    const now = new Date()
    await setCachedScore(
      'coverage-user',
      {
        slop_score: 60,
        tier: 'the context window regular',
        tier_tagline: 'you have a system prompt and a ritual',
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

describe('queued jobs', () => {
  it('dedupes a second create for a queued user and sends one message', async () => {
    const first = await createOrAttachScoreJob('queued-user')
    const second = await createOrAttachScoreJob('Queued-User')
    if (!first.ok || !second.ok) throw new Error('Expected both to succeed')

    assert.equal(first.snapshot.status, 'queued')
    assert.equal(second.snapshot.job_id, first.snapshot.job_id)
    assert.deepEqual(fake.sent, [
      { job_id: first.snapshot.job_id, username: 'queued-user' },
    ])
  })

  it('removes the row when the queue send fails', async () => {
    fake.env.SCORE_QUEUE.send = async () => {
      throw new Error('queue down')
    }
    await assert.rejects(createOrAttachScoreJob('send-fail'), /queue down/)
    const row = await fake.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM score_jobs',
    ).first<{ n: number }>()
    assert.equal(row?.n, 0)
  })

  it('reports a stale running job as failed without persisting it', async () => {
    const created = await createOrAttachScoreJob('stale-user')
    if (!created.ok) throw new Error('Expected success')
    const jobId = created.snapshot.job_id
    await fake.env.DB.prepare(
      "UPDATE score_jobs SET status = 'running', updated_at = ? WHERE job_id = ?",
    )
      .bind(Date.now() - STALE_MS - 1, jobId)
      .run()

    const snapshot = await getScoreJob(jobId)
    assert.equal(snapshot?.status, 'failed')
    assert.equal(snapshot?.progress_percent, 100)
    assert.equal(snapshot?.error?.code, 'server_error')

    const row = await fake.env.DB.prepare(
      'SELECT status FROM score_jobs WHERE job_id = ?',
    )
      .bind(jobId)
      .first<{ status: string }>()
    assert.equal(row?.status, 'running')

    // A new request replaces the dead job instead of attaching to it.
    const retried = await createOrAttachScoreJob('stale-user')
    if (!retried.ok) throw new Error('Expected success')
    assert.notEqual(retried.snapshot.job_id, jobId)
    assert.equal(retried.snapshot.status, 'queued')
  })
})

describe('queued staleness', () => {
  const ageJob = (jobId: string, ageMs: number) =>
    fake.env.DB.prepare('UPDATE score_jobs SET updated_at = ? WHERE job_id = ?')
      .bind(Date.now() - ageMs, jobId)
      .run()

  it('keeps a job waiting in a long backlog alive', async () => {
    const created = await createOrAttachScoreJob('backlog-user')
    if (!created.ok) throw new Error('Expected success')
    await ageJob(created.snapshot.job_id, STALE_MS + 60_000)

    assert.equal((await getScoreJob(created.snapshot.job_id))?.status, 'queued')
    const again = await createOrAttachScoreJob('backlog-user')
    if (!again.ok) throw new Error('Expected success')
    assert.equal(again.snapshot.job_id, created.snapshot.job_id)
    assert.equal(fake.sent.length, 1)
  })

  it('gives up on a queued job past the queued cutoff', async () => {
    const created = await createOrAttachScoreJob('lost-user')
    if (!created.ok) throw new Error('Expected success')
    await ageJob(created.snapshot.job_id, QUEUED_STALE_MS + 1)

    assert.equal((await getScoreJob(created.snapshot.job_id))?.status, 'failed')
    const again = await createOrAttachScoreJob('lost-user')
    if (!again.ok) throw new Error('Expected success')
    assert.notEqual(again.snapshot.job_id, created.snapshot.job_id)
  })
})

describe('processScoreJob', () => {
  it('is a no-op for a missing job', async () => {
    await processScoreJob({ job_id: 'missing', username: 'nobody' })
    assert.equal(await getScoreJob('missing'), null)
  })

  it('is a no-op for a terminal job', async () => {
    await setCachedScore(
      'done-user',
      {
        slop_score: 12,
        tier: 'the tab-key athlete',
        tier_tagline: 'autocomplete exists. you choose not to know.',
        confidence: 'low',
        top_signals: [],
        scoring_window: 'last 180 days',
        analyzed_commits: [],
      },
      new Date(),
      60_000,
    )
    const created = await createOrAttachScoreJob('done-user')
    if (!created.ok) throw new Error('Expected success')

    await processScoreJob({
      job_id: created.snapshot.job_id,
      username: 'done-user',
    })
    const after = await getScoreJob(created.snapshot.job_id)
    assert.deepEqual(after, created.snapshot)
  })

  it('completes a queued job and writes cache and leaderboard', async () => {
    const created = await createOrAttachScoreJob('happy-user')
    if (!created.ok) throw new Error('Expected success')
    assert.equal(created.snapshot.status, 'queued')

    await processScoreJob(fake.sent[0])

    const done = await getScoreJob(created.snapshot.job_id)
    assert.equal(done?.status, 'completed')
    assert.equal(done?.progress_percent, 100)
    assert.ok(done?.result)

    const lb = await fake.env.DB.prepare(
      'SELECT username FROM leaderboard WHERE username_key = ?',
    )
      .bind('happy-user')
      .first<{ username: string }>()
    assert.equal(lb?.username, 'happy-user')
    assert.ok(await fake.env.CACHE.get('score:v1:happy-user', 'json'))

    // Once complete, the next request is served from the cache.
    const again = await createOrAttachScoreJob('happy-user')
    if (!again.ok) throw new Error('Expected success')
    assert.equal(again.snapshot.status, 'completed')
    assert.equal(fake.sent.length, 1)
  })

  it('records a scoring failure on the job instead of throwing', async () => {
    const created = await createOrAttachScoreJob('ghost-user')
    if (!created.ok) throw new Error('Expected success')
    globalThis.fetch = (async () =>
      new Response('{}', { status: 404 })) as typeof fetch

    await processScoreJob(fake.sent[0])

    const failed = await getScoreJob(created.snapshot.job_id)
    assert.equal(failed?.status, 'failed')
    assert.equal(failed?.error?.code, 'not_found')
  })

  it('skips a duplicate delivery of a live running job, but a retry takes over', async () => {
    const created = await createOrAttachScoreJob('dup-user')
    if (!created.ok) throw new Error('Expected success')
    const jobId = created.snapshot.job_id
    await fake.env.DB.prepare(
      "UPDATE score_jobs SET status = 'running' WHERE job_id = ?",
    )
      .bind(jobId)
      .run()

    await processScoreJob(fake.sent[0])
    assert.equal((await getScoreJob(jobId))?.status, 'queued')

    await processScoreJob(fake.sent[0], 2)
    assert.equal((await getScoreJob(jobId))?.status, 'completed')
  })

  it('fails the job when a commit fetch hits a non-GitHub error', async () => {
    const created = await createOrAttachScoreJob('subreq-user')
    if (!created.ok) throw new Error('Expected success')
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname.startsWith('/repos/o/r/commits/')) {
        throw new Error('Too many subrequests.')
      }
      let body: unknown = []
      if (url.pathname === '/users/subreq-user') {
        body = { login: 'subreq-user', type: 'User' }
      } else if (
        url.pathname === '/users/subreq-user/events/public' &&
        url.searchParams.get('page') === '1'
      ) {
        body = [
          {
            type: 'PushEvent',
            repo: { name: 'o/r' },
            created_at: new Date().toISOString(),
            payload: { commits: [{ sha: 'subreq-sha', message: 'feat: x' }] },
          },
        ]
      }
      return Response.json(body)
    }) as typeof fetch

    await processScoreJob(fake.sent[0])

    const failed = await getScoreJob(created.snapshot.job_id)
    assert.equal(failed?.status, 'failed')
    assert.equal(failed?.error?.code, 'server_error')
    assert.equal(await fake.env.CACHE.get('score:v1:subreq-user', 'json'), null)
  })

  it('serves a just-completed job from D1 when KV misses', async () => {
    const created = await createOrAttachScoreJob('fresh-user')
    if (!created.ok) throw new Error('Expected success')
    await processScoreJob(fake.sent[0])
    // Simulate KV's edge-cached miss right after the write.
    await fake.env.CACHE.delete('score:v1:fresh-user')

    const again = await createOrAttachScoreJob('fresh-user')
    if (!again.ok) throw new Error('Expected success')
    assert.equal(again.snapshot.job_id, created.snapshot.job_id)
    assert.equal(again.snapshot.status, 'completed')
    assert.equal(fake.sent.length, 1)
  })
})

describe('failScoreJob', () => {
  it('marks an active job failed and leaves terminal jobs alone', async () => {
    const created = await createOrAttachScoreJob('doomed-user')
    if (!created.ok) throw new Error('Expected success')

    await failScoreJob(created.snapshot.job_id)
    const failed = await getScoreJob(created.snapshot.job_id)
    assert.equal(failed?.status, 'failed')
    assert.equal(failed?.error?.code, 'server_error')

    // The failed job no longer blocks a fresh request.
    const again = await createOrAttachScoreJob('doomed-user')
    if (!again.ok) throw new Error('Expected success')
    assert.notEqual(again.snapshot.job_id, created.snapshot.job_id)
  })
})
