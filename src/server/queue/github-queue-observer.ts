import { getGitHubClientSelectionStats } from '../github/client'
import {
  GITHUB_QUEUE_DELAYED_ZSET_KEY,
  GITHUB_QUEUE_GROUP_NAME,
  GITHUB_QUEUE_STREAM_KEY,
  GITHUB_QUEUE_WORKER_CONCURRENCY,
  getGitHubQueueCommandClient,
  getGitHubQueueRuntimeMetrics,
  isGitHubRequestQueueEnabled,
} from './github-request-queue'

type RedisInfoRow = Record<string, unknown>

export type GitHubQueueHealth = 'disabled' | 'ok' | 'degraded'

export type GitHubQueueConsumerSnapshot = {
  name: string
  pending: number
  idle_ms: number
  inactive_ms: number | null
}

export type GitHubQueueSnapshot = {
  enabled: boolean
  health: GitHubQueueHealth
  generated_at: string
  warnings: string[]
  client_selection: {
    queued: number
    raw_fetcher: number
    raw_queue_disabled: number
    last_selected: 'queued' | 'raw_fetcher' | 'raw_queue_disabled' | null
    updated_at: string | null
  }
  runtime: {
    started: boolean
    has_command_client: boolean
    worker_starts: number
    enqueued: number
    worker_processed: number
    responses_stored: number
    responses_consumed: number
    retries_scheduled: number
    timeouts: number
  }
  queue: {
    workers_configured: number
    stream_initialized: boolean
    lag: number | null
    pending: number
    delayed: number
    active_consumers: number
    processed_entries: number | null
    next_retry_at: string | null
    next_retry_in_ms: number | null
  }
  consumers: GitHubQueueConsumerSnapshot[]
}

const toRedisInfoRow = (value: unknown): RedisInfoRow | null => {
  if (Array.isArray(value)) {
    const row: RedisInfoRow = {}

    for (let index = 0; index < value.length; index += 2) {
      const key = value[index]
      const entryValue = value[index + 1]
      if (typeof key !== 'string') {
        continue
      }
      row[key] = entryValue
    }

    return row
  }

  if (typeof value === 'object' && value !== null) {
    return value as RedisInfoRow
  }

  return null
}

export const parseRedisInfoRows = (input: unknown): RedisInfoRow[] => {
  if (!Array.isArray(input)) {
    return []
  }

  const rows: RedisInfoRow[] = []

  for (const value of input) {
    const row = toRedisInfoRow(value)
    if (!row) {
      continue
    }
    rows.push(row)
  }

  return rows
}

const toNonNegativeInteger = (value: unknown): number | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null
    }
    return Math.max(0, Math.trunc(value))
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
      return null
    }
    return Math.max(0, parsed)
  }

  return null
}

const parseDelayedRetryTimestamp = (raw: unknown): number | null => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null
  }

  const first = raw[0]
  if (Array.isArray(first) && first.length >= 2) {
    return toNonNegativeInteger(first[1])
  }

  if (raw.length >= 2) {
    return toNonNegativeInteger(raw[1])
  }

  return null
}

const createSnapshotBase = (
  generatedAt: string,
  health: GitHubQueueHealth,
  warnings: string[] = [],
): GitHubQueueSnapshot => ({
  enabled: health !== 'disabled',
  health,
  generated_at: generatedAt,
  warnings,
  client_selection: getGitHubClientSelectionStats(),
  runtime: getGitHubQueueRuntimeMetrics(),
  queue: {
    workers_configured: GITHUB_QUEUE_WORKER_CONCURRENCY,
    stream_initialized: false,
    lag: null,
    pending: 0,
    delayed: 0,
    active_consumers: 0,
    processed_entries: null,
    next_retry_at: null,
    next_retry_in_ms: null,
  },
  consumers: [],
})

const isMissingKeyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('no such key')
}

export const getGitHubQueueSnapshot =
  async (): Promise<GitHubQueueSnapshot> => {
    const generatedAt = new Date().toISOString()
    if (!isGitHubRequestQueueEnabled()) {
      return createSnapshotBase(generatedAt, 'disabled', [
        'Queue mode disabled. Set REDIS_URL to enable centralized GitHub queueing.',
      ])
    }

    const client = getGitHubQueueCommandClient()
    if (!client) {
      return createSnapshotBase(generatedAt, 'disabled', [
        'Queue mode disabled. Set REDIS_URL to enable centralized GitHub queueing.',
      ])
    }

    const warnings: string[] = []
    let health: Exclude<GitHubQueueHealth, 'disabled'> = 'ok'

    let streamInitialized = false
    let lag: number | null = null
    let pending = 0
    let activeConsumers = 0
    let processedEntries: number | null = null
    let delayed = 0
    let delayedRetryAtMs: number | null = null
    let consumers: GitHubQueueConsumerSnapshot[] = []

    const markDegraded = (warning: string) => {
      health = 'degraded'
      warnings.push(warning)
    }

    try {
      const rawGroups = await client.call(
        'XINFO',
        'GROUPS',
        GITHUB_QUEUE_STREAM_KEY,
      )
      const groups = parseRedisInfoRows(rawGroups)
      const group = groups.find(
        (entry) =>
          typeof entry.name === 'string' &&
          entry.name === GITHUB_QUEUE_GROUP_NAME,
      )

      if (group) {
        streamInitialized = true
        lag = toNonNegativeInteger(group.lag)
        pending = toNonNegativeInteger(group.pending) ?? 0
        activeConsumers = toNonNegativeInteger(group.consumers) ?? 0
        processedEntries =
          toNonNegativeInteger(group['entries-read']) ??
          toNonNegativeInteger(group.entries_read) ??
          toNonNegativeInteger(group.entriesRead)
      }
    } catch (error) {
      if (!isMissingKeyError(error)) {
        markDegraded('Unable to read Redis stream group stats.')
      }
    }

    if (streamInitialized) {
      try {
        const rawConsumers = await client.call(
          'XINFO',
          'CONSUMERS',
          GITHUB_QUEUE_STREAM_KEY,
          GITHUB_QUEUE_GROUP_NAME,
        )
        consumers = parseRedisInfoRows(rawConsumers)
          .map((entry): GitHubQueueConsumerSnapshot => {
            return {
              name:
                typeof entry.name === 'string'
                  ? entry.name
                  : 'unknown-consumer',
              pending: toNonNegativeInteger(entry.pending) ?? 0,
              idle_ms: toNonNegativeInteger(entry.idle) ?? 0,
              inactive_ms: toNonNegativeInteger(entry.inactive),
            }
          })
          .sort((left, right) => right.pending - left.pending)

        if (consumers.length > 0) {
          activeConsumers = consumers.length
        }
      } catch {
        markDegraded('Unable to read Redis consumer stats.')
      }
    }

    try {
      delayed = await client.zcard(GITHUB_QUEUE_DELAYED_ZSET_KEY)
    } catch {
      markDegraded('Unable to read delayed retry depth.')
    }

    try {
      const rawNextRetry = await client.zrange(
        GITHUB_QUEUE_DELAYED_ZSET_KEY,
        0,
        0,
        'WITHSCORES',
      )
      delayedRetryAtMs = parseDelayedRetryTimestamp(rawNextRetry)
    } catch {
      markDegraded('Unable to read next retry timestamp.')
    }

    if (!streamInitialized && health === 'ok') {
      warnings.push(
        'Queue stream is idle. Start a score job to initialize workers.',
      )
    }

    const snapshot: GitHubQueueSnapshot = {
      enabled: true,
      health,
      generated_at: generatedAt,
      warnings,
      client_selection: getGitHubClientSelectionStats(),
      runtime: getGitHubQueueRuntimeMetrics(),
      queue: {
        workers_configured: GITHUB_QUEUE_WORKER_CONCURRENCY,
        stream_initialized: streamInitialized,
        lag,
        pending,
        delayed,
        active_consumers: activeConsumers,
        processed_entries: processedEntries,
        next_retry_at: delayedRetryAtMs
          ? new Date(delayedRetryAtMs).toISOString()
          : null,
        next_retry_in_ms: delayedRetryAtMs
          ? Math.max(0, delayedRetryAtMs - Date.now())
          : null,
      },
      consumers,
    }

    return snapshot
  }
