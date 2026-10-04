import { getCachedScore, setCachedScore } from '../cache'
import { getEnv, type ScoreJobMessage } from '../env'
import {
  GitHubNotFoundError,
  GitHubOrganizationError,
  GitHubRateLimitError,
  GitHubValidationError,
  isValidGitHubUsername,
} from '../github'
import { createGitHubClient } from '../github/client'
import { upsertLeaderboardEntry } from '../leaderboard'
import { prerenderOgImage } from '../og/prerender'
import { getScoreP95, recordScoreTiming } from '../perf/metrics'
import type { SlopScoreResult } from '../scoring'
import {
  type ScoreCoverage,
  type ScoreLimits,
  type ScoreUserProgress,
  scoreUserWithMetadata,
} from './score'

export type ScoreJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export type ScoreJobError = {
  code:
    | 'invalid_username'
    | 'is_organization'
    | 'not_found'
    | 'rate_limited'
    | 'server_error'
  message: string
  reset_at?: string
}

export type ScoreJobSnapshot = {
  job_id: string
  username: string
  status: ScoreJobStatus
  stage: 'queued' | ScoreUserProgress['stage']
  progress_percent: number
  result: SlopScoreResult | null
  coverage: ScoreCoverage
  limits: ScoreLimits
  error: ScoreJobError | null
  created_at: string
  updated_at: string
}

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000
export const JOB_RETENTION_MS = 30 * 60 * 1000
// Matches the queue consumer's 15-minute wall clock: a running job not updated for this long is dead.
export const STALE_MS = 15 * 60 * 1000
// A queued row only waits on the backlog, so it gets a far larger allowance before it is presumed lost.
export const QUEUED_STALE_MS = 6 * 60 * 60 * 1000
const PROGRESS_DEBOUNCE_MS = 2_000
// Binds (runningCutoff, queuedCutoff); see staleCutoffs().
export const STALE_SQL =
  "((status = 'running' AND updated_at < ?) OR (status = 'queued' AND updated_at < ?))"
export const staleCutoffs = (now = Date.now()) =>
  [now - STALE_MS, now - QUEUED_STALE_MS] as const
export const isStale = (
  status: ScoreJobStatus,
  updatedAt: number,
  now = Date.now(),
) =>
  (status === 'running' && updatedAt < now - STALE_MS) ||
  (status === 'queued' && updatedAt < now - QUEUED_STALE_MS)

const emptyCoverage: ScoreCoverage = {
  commits_discovered: 0,
  commits_enriched: 0,
  repos_scanned: 0,
  repos_total: 0,
  window_days: 180,
  is_partial: true,
  sources_used: [],
}

const emptyLimits: ScoreLimits = {
  rate_limited: false,
  events_pagination_limited: false,
}

const serverError: ScoreJobError = {
  code: 'server_error',
  message: 'Unable to compute score right now.',
}

const mapError = (error: unknown): ScoreJobError => {
  if (error instanceof GitHubNotFoundError) {
    return {
      code: 'not_found',
      message: 'GitHub user not found.',
    }
  }

  if (error instanceof GitHubOrganizationError) {
    return {
      code: 'is_organization',
      message: 'GitHub organization accounts are not supported.',
    }
  }

  if (error instanceof GitHubRateLimitError) {
    return {
      code: 'rate_limited',
      message: 'GitHub API rate limit exceeded.',
      reset_at: error.resetAt,
    }
  }

  if (error instanceof GitHubValidationError) {
    return {
      code: 'invalid_username',
      message: error.message,
    }
  }

  return serverError
}

const db = () => getEnv().DB

const insertJob = (snapshot: ScoreJobSnapshot, now: number, orIgnore = '') =>
  db()
    .prepare(
      `INSERT ${orIgnore} INTO score_jobs (job_id, username_key, status, snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING job_id`,
    )
    .bind(
      snapshot.job_id,
      snapshot.username.toLowerCase(),
      snapshot.status,
      JSON.stringify(snapshot),
      now,
      now,
    )
    .first<{ job_id: string }>()

const saveJob = async (snapshot: ScoreJobSnapshot) => {
  snapshot.updated_at = new Date().toISOString()
  await db()
    .prepare(
      'UPDATE score_jobs SET status = ?, snapshot = ?, updated_at = ? WHERE job_id = ?',
    )
    .bind(
      snapshot.status,
      JSON.stringify(snapshot),
      Date.now(),
      snapshot.job_id,
    )
    .run()
}

// The active job if any, else the latest completed one. D1 sees its own writes, unlike KV,
// whose edge can cache a miss for ~60s and so would trigger a full rescore right after a job finishes.
const getReusableSnapshot = async (usernameKey: string) => {
  const row = await db()
    .prepare(
      "SELECT snapshot FROM score_jobs WHERE username_key = ? AND status != 'failed' ORDER BY status = 'completed', updated_at DESC LIMIT 1",
    )
    .bind(usernameKey)
    .first<{ snapshot: string }>()
  return row ? (JSON.parse(row.snapshot) as ScoreJobSnapshot) : null
}

export const createOrAttachScoreJob = async (usernameRaw: string) => {
  const username = usernameRaw.trim()
  if (!isValidGitHubUsername(username)) {
    return {
      ok: false as const,
      error: {
        code: 'invalid_username',
        message: 'Invalid GitHub username.',
      } satisfies ScoreJobError,
    }
  }

  // Check if this is an organization account
  const token = process.env.GITHUB_TOKEN
  const client = createGitHubClient({ token })
  try {
    const user = await client.getUser(username)
    if (user.type === 'Organization') {
      return {
        ok: false as const,
        error: {
          code: 'is_organization',
          message: 'Organization accounts are not supported.',
        } satisfies ScoreJobError,
      }
    }
  } catch {
    // Let the error propagate through normal scoring flow
  }

  const key = username.toLowerCase()
  const nowMs = Date.now()
  await db().batch([
    db()
      .prepare(
        "DELETE FROM score_jobs WHERE status IN ('completed','failed') AND updated_at < ?",
      )
      .bind(nowMs - JOB_RETENTION_MS),
    db()
      .prepare(`DELETE FROM score_jobs WHERE username_key = ? AND ${STALE_SQL}`)
      .bind(key, ...staleCutoffs(nowMs)),
  ])

  const reusable = await getReusableSnapshot(key)
  if (reusable) {
    return { ok: true as const, snapshot: reusable }
  }

  const now = new Date(nowMs)
  const createdAt = now.toISOString()
  const cached = await getCachedScore(username, now)
  if (cached) {
    const snapshot: ScoreJobSnapshot = {
      job_id: crypto.randomUUID(),
      username,
      status: 'completed',
      stage: 'finalizing',
      progress_percent: 100,
      result: cached,
      coverage: {
        ...emptyCoverage,
        commits_discovered: cached.analyzed_commits.length,
        commits_enriched: cached.analyzed_commits.filter(
          (commit) =>
            commit.additions !== undefined || commit.deletions !== undefined,
        ).length,
        is_partial: false,
      },
      limits: emptyLimits,
      error: null,
      created_at: createdAt,
      updated_at: createdAt,
    }
    await insertJob(snapshot, nowMs)
    return { ok: true as const, snapshot }
  }

  const snapshot: ScoreJobSnapshot = {
    job_id: crypto.randomUUID(),
    username,
    status: 'queued',
    stage: 'queued',
    progress_percent: 0,
    result: null,
    coverage: emptyCoverage,
    limits: emptyLimits,
    error: null,
    created_at: createdAt,
    updated_at: createdAt,
  }

  // The partial unique index allows one active job per username; a lost race returns null.
  if (!(await insertJob(snapshot, nowMs, 'OR IGNORE'))) {
    const winner = await getReusableSnapshot(key)
    if (winner) return { ok: true as const, snapshot: winner }
    throw new Error('score_job_insert_conflict')
  }

  try {
    await getEnv().SCORE_QUEUE.send({ job_id: snapshot.job_id, username })
  } catch (error) {
    await db()
      .prepare('DELETE FROM score_jobs WHERE job_id = ?')
      .bind(snapshot.job_id)
      .run()
    throw error
  }

  return { ok: true as const, snapshot }
}

export const getScoreJob = async (
  jobId: string,
): Promise<ScoreJobSnapshot | null> => {
  const row = await db()
    .prepare(
      'SELECT snapshot, status, updated_at FROM score_jobs WHERE job_id = ?',
    )
    .bind(jobId)
    .first<{ snapshot: string; status: ScoreJobStatus; updated_at: number }>()
  if (!row) return null

  const snapshot = JSON.parse(row.snapshot) as ScoreJobSnapshot
  if (isStale(row.status, row.updated_at)) {
    return {
      ...snapshot,
      status: 'failed',
      stage: 'finalizing',
      progress_percent: 100,
      error: serverError,
    }
  }
  return snapshot
}

// Queue consumer entry. Scoring errors are recorded on the job; only D1/infra errors throw
// (which makes the queue retry). Terminal or missing jobs are skipped, so redelivery is safe.
export const processScoreJob = async (
  message: ScoreJobMessage,
  attempts = 1,
) => {
  // Atomic claim: a duplicate first delivery of a live running job gets no row. A retry
  // (attempts > 1) follows a failed attempt of this same message, so it may take over a running row.
  const now0 = Date.now()
  const row = await db()
    .prepare(
      "UPDATE score_jobs SET status = 'running', updated_at = ? WHERE job_id = ? AND (status = 'queued' OR (status = 'running' AND updated_at < ?)) RETURNING snapshot",
    )
    .bind(now0, message.job_id, attempts > 1 ? now0 + 1 : now0 - STALE_MS)
    .first<{ snapshot: string }>()
  if (!row) return

  const job = JSON.parse(row.snapshot) as ScoreJobSnapshot
  const start = Date.now()
  job.status = 'running'
  job.stage = 'discovering'
  job.progress_percent = 5
  await saveJob(job)
  let lastPersistedAt = Date.now()

  let scored: Awaited<ReturnType<typeof scoreUserWithMetadata>>
  try {
    scored = await scoreUserWithMetadata(job.username, {
      onProgress: async (progress) => {
        const stageChanged = job.stage !== progress.stage
        job.status = 'running'
        job.stage = progress.stage
        job.progress_percent = progress.progress_percent
        job.result = progress.result
        job.coverage = progress.coverage
        job.limits = progress.limits
        job.error = null
        if (
          !stageChanged &&
          Date.now() - lastPersistedAt < PROGRESS_DEBOUNCE_MS
        )
          return
        lastPersistedAt = Date.now()
        await saveJob(job)
      },
    })
  } catch (error) {
    job.status = 'failed'
    job.stage = 'finalizing'
    job.progress_percent = 100
    job.error = mapError(error)
    if (job.error === serverError) {
      console.error('score_job_failed', { job_id: job.job_id, error })
    }
    await saveJob(job)
    return
  }

  job.status = 'completed'
  job.stage = 'finalizing'
  job.progress_percent = 100
  job.result = scored.result
  job.coverage = scored.coverage
  job.limits = scored.limits
  job.error = null
  await saveJob(job)

  const now = new Date()
  await setCachedScore(job.username, scored.result, now, DEFAULT_CACHE_TTL_MS)
  await upsertLeaderboardEntry({
    username: job.username,
    slop_score: scored.result.slop_score,
    tier: scored.result.tier,
    tier_tagline: scored.result.tier_tagline,
    confidence: scored.result.confidence,
    last_scored_at: now.toISOString(),
  })
  await prerenderOgImage(
    job.username,
    scored.result,
    scored.coverage,
    scored.limits,
  ).catch((err) =>
    console.warn('og_prerender_failed', { username: job.username, err }),
  )

  const durationMs = Date.now() - start
  recordScoreTiming(durationMs)
  const p95 = getScoreP95()
  console.info('score_request', {
    username: job.username,
    duration_ms: Math.round(durationMs),
    p95_ms: p95 ? Math.round(p95) : null,
    source: 'score_job',
  })
}

// Called by the queue consumer when the last delivery attempt failed, so the job does not sit
// "running" until the stale cutoff. Best effort: the stale rule still covers it if this throws.
export const failScoreJob = async (jobId: string) => {
  const row = await db()
    .prepare(
      "SELECT snapshot FROM score_jobs WHERE job_id = ? AND status IN ('queued','running')",
    )
    .bind(jobId)
    .first<{ snapshot: string }>()
  if (!row) return
  const job = JSON.parse(row.snapshot) as ScoreJobSnapshot
  job.status = 'failed'
  job.stage = 'finalizing'
  job.progress_percent = 100
  job.error = serverError
  await saveJob(job)
}
