import type { QueueSnapshot } from '../../app/ops/queue/queue-types'
import {
  isStale,
  JOB_RETENTION_MS,
  type ScoreJobStatus,
} from '../api/score-jobs'
import { getEnv, hasEnv } from '../env'

// Must match max_concurrency of the areyougoingtoslop-score-jobs consumer in wrangler.jsonc.
export const SCORE_QUEUE_MAX_CONCURRENCY = 4

export type GitHubQueueSnapshot = QueueSnapshot & {
  queue: QueueSnapshot['queue'] & {
    known_consumers: number
    online_consumers: number
  }
}

type JobRow = {
  job_id: string
  username_key: string
  status: ScoreJobStatus
  updated_at: number
}

const base = (
  health: GitHubQueueSnapshot['health'],
  warnings: string[],
): GitHubQueueSnapshot => ({
  enabled: health !== 'disabled',
  health,
  generated_at: new Date().toISOString(),
  warnings,
  queue: {
    workers_configured: SCORE_QUEUE_MAX_CONCURRENCY,
    stream_initialized: health !== 'disabled',
    lag: null,
    pending: 0,
    delayed: 0,
    known_consumers: 0,
    online_consumers: 0,
    active_consumers: 0,
    processed_entries: null,
    next_retry_at: null,
    next_retry_in_ms: null,
  },
  consumers: [],
  recent_usernames: [],
  active_score_usernames: [],
})

// Ops view derived from score_jobs: queued rows are the backlog, running rows the busy consumers.
export const getGitHubQueueSnapshot =
  async (): Promise<GitHubQueueSnapshot> => {
    if (!hasEnv()) return base('disabled', ['Queue bindings unavailable.'])

    const now = Date.now()
    let rows: JobRow[]
    try {
      rows = (
        await getEnv()
          .DB.prepare(
            "SELECT job_id, username_key, status, updated_at FROM score_jobs WHERE status IN ('queued','running') OR updated_at >= ? ORDER BY updated_at DESC LIMIT 500",
          )
          .bind(now - JOB_RETENTION_MS)
          .all<JobRow>()
      ).results
    } catch (error) {
      console.warn('queue_snapshot_failed', { error })
      return base('degraded', ['Unable to read score job stats.'])
    }

    // Stale active rows are dead jobs (getScoreJob already reports them failed); don't count them.
    rows = rows.filter((row) => !isStale(row.status, row.updated_at, now))
    const queued = rows.filter((row) => row.status === 'queued')
    const running = rows.filter((row) => row.status === 'running')
    const snapshot = base('ok', [])
    snapshot.queue = {
      ...snapshot.queue,
      lag: queued.length,
      pending: running.length,
      known_consumers: running.length,
      online_consumers: running.length,
      active_consumers: running.length,
      processed_entries: rows.length - queued.length - running.length,
    }
    snapshot.consumers = running.map((row) => ({
      name: `job-${row.job_id.slice(0, 8)}`,
      pending: 1,
      idle_ms: Math.max(0, now - row.updated_at),
      inactive_ms: null,
      current_usernames: [row.username_key],
    }))
    snapshot.active_score_usernames = [...running, ...queued].map(
      (row) => row.username_key,
    )
    snapshot.recent_usernames = [
      ...new Set(
        rows
          .filter((row) => row.status === 'completed')
          .map((row) => row.username_key),
      ),
    ].slice(0, 10)
    return snapshot
  }
