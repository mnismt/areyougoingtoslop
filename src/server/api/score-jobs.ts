import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { getCachedScore, setCachedScore } from '../cache'
import {
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubValidationError,
  isValidGitHubUsername,
} from '../github'
import { upsertLeaderboardEntry } from '../leaderboard'
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
  code: 'invalid_username' | 'not_found' | 'rate_limited' | 'server_error'
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

type InternalScoreJob = {
  jobId: string
  username: string
  status: ScoreJobStatus
  stage: ScoreJobSnapshot['stage']
  progressPercent: number
  result: SlopScoreResult | null
  coverage: ScoreCoverage
  limits: ScoreLimits
  error: ScoreJobError | null
  createdAt: string
  updatedAt: string
}

type ScoreJobRuntimeState = {
  jobs: Map<string, InternalScoreJob>
  activeByUsername: Map<string, string>
}

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000
const JOB_RETENTION_MS = 30 * 60 * 1000

const getRuntimeState = (): ScoreJobRuntimeState => {
  const globalState = globalThis as typeof globalThis & {
    __aysScoreJobsState?: ScoreJobRuntimeState
  }

  if (!globalState.__aysScoreJobsState) {
    globalState.__aysScoreJobsState = {
      jobs: new Map<string, InternalScoreJob>(),
      activeByUsername: new Map<string, string>(),
    }
  }

  return globalState.__aysScoreJobsState
}

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

const toSnapshot = (job: InternalScoreJob): ScoreJobSnapshot => ({
  job_id: job.jobId,
  username: job.username,
  status: job.status,
  stage: job.stage,
  progress_percent: job.progressPercent,
  result: job.result,
  coverage: job.coverage,
  limits: job.limits,
  error: job.error,
  created_at: job.createdAt,
  updated_at: job.updatedAt,
})

const touch = (job: InternalScoreJob) => {
  job.updatedAt = new Date().toISOString()
}

const cleanupJobs = () => {
  const { jobs, activeByUsername } = getRuntimeState()
  const cutoff = Date.now() - JOB_RETENTION_MS
  for (const [jobId, job] of jobs) {
    const updatedAt = new Date(job.updatedAt).getTime()
    if (!Number.isNaN(updatedAt) && updatedAt < cutoff) {
      jobs.delete(jobId)
      const key = job.username.toLowerCase()
      if (activeByUsername.get(key) === jobId) {
        activeByUsername.delete(key)
      }
    }
  }
}

const mapError = (error: unknown): ScoreJobError => {
  if (error instanceof GitHubNotFoundError) {
    return {
      code: 'not_found',
      message: 'GitHub user not found.',
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

  return {
    code: 'server_error',
    message: 'Unable to compute score right now.',
  }
}

const runScoreJob = async (jobId: string) => {
  const { jobs, activeByUsername } = getRuntimeState()
  const job = jobs.get(jobId)
  if (!job) {
    return
  }

  const start = performance.now()
  job.status = 'running'
  job.stage = 'discovering'
  job.progressPercent = 5
  touch(job)

  try {
    const result = await scoreUserWithMetadata(job.username, {
      onProgress: (progress) => {
        job.status = 'running'
        job.stage = progress.stage
        job.progressPercent = progress.progress_percent
        job.result = progress.result
        job.coverage = progress.coverage
        job.limits = progress.limits
        job.error = null
        touch(job)
      },
    })

    job.status = 'completed'
    job.stage = 'finalizing'
    job.progressPercent = 100
    job.result = result.result
    job.coverage = result.coverage
    job.limits = result.limits
    job.error = null
    touch(job)

    const now = new Date()
    setCachedScore(job.username, result.result, now, DEFAULT_CACHE_TTL_MS)

    await upsertLeaderboardEntry({
      username: job.username,
      slop_score: result.result.slop_score,
      tier: result.result.tier,
      confidence: result.result.confidence,
      last_scored_at: now.toISOString(),
    })

    const durationMs = performance.now() - start
    recordScoreTiming(durationMs)
    const p95 = getScoreP95()
    console.info('score_request', {
      username: job.username,
      duration_ms: Math.round(durationMs),
      p95_ms: p95 ? Math.round(p95) : null,
      source: 'score_job',
    })
  } catch (error) {
    job.status = 'failed'
    job.stage = 'finalizing'
    job.error = mapError(error)
    job.progressPercent = 100
    touch(job)
  } finally {
    const key = job.username.toLowerCase()
    if (activeByUsername.get(key) === jobId) {
      activeByUsername.delete(key)
    }
  }
}

export const createOrAttachScoreJob = (usernameRaw: string) => {
  const { jobs, activeByUsername } = getRuntimeState()
  cleanupJobs()

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

  const existingJobId = activeByUsername.get(username.toLowerCase())
  if (existingJobId) {
    const existingJob = jobs.get(existingJobId)
    if (existingJob && existingJob.status !== 'failed') {
      return {
        ok: true as const,
        snapshot: toSnapshot(existingJob),
      }
    }
  }

  const now = new Date()
  const cached = getCachedScore(username, now)
  if (cached) {
    const jobId = randomUUID()
    const createdAt = now.toISOString()
    const job: InternalScoreJob = {
      jobId,
      username,
      status: 'completed',
      stage: 'finalizing',
      progressPercent: 100,
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
      createdAt,
      updatedAt: createdAt,
    }

    jobs.set(jobId, job)

    return {
      ok: true as const,
      snapshot: toSnapshot(job),
    }
  }

  const createdAt = now.toISOString()
  const jobId = randomUUID()
  const job: InternalScoreJob = {
    jobId,
    username,
    status: 'queued',
    stage: 'queued',
    progressPercent: 0,
    result: null,
    coverage: emptyCoverage,
    limits: emptyLimits,
    error: null,
    createdAt,
    updatedAt: createdAt,
  }

  jobs.set(jobId, job)
  activeByUsername.set(username.toLowerCase(), jobId)

  void runScoreJob(jobId)

  return {
    ok: true as const,
    snapshot: toSnapshot(job),
  }
}

export const getScoreJob = (jobId: string) => {
  const { jobs } = getRuntimeState()
  cleanupJobs()
  const job = jobs.get(jobId)
  if (!job) {
    return null
  }
  return toSnapshot(job)
}

export const clearScoreJobs = () => {
  const { jobs, activeByUsername } = getRuntimeState()
  jobs.clear()
  activeByUsername.clear()
}
