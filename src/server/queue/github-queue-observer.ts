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
  current_usernames: string[]
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
    known_consumers: number
    online_consumers: number
    active_consumers: number
    processed_entries: number | null
    next_retry_at: string | null
    next_retry_in_ms: number | null
  }
  consumers: GitHubQueueConsumerSnapshot[]
  recent_usernames: string[]
  active_score_usernames: string[]
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

const ONLINE_CONSUMER_IDLE_MS = 60 * 1000

const isMissingKeyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('no such key')
}

const extractUsernameFromRequest = (req: {
  kind: string
  payload: unknown
}): string | null => {
  const payload = req.payload as Record<string, unknown>
  switch (req.kind) {
    case 'get_user':
    case 'list_user_public_events':
    case 'list_user_repos':
      return typeof payload?.username === 'string' ? payload.username : null
    case 'list_repo_commits': {
      const query = payload?.query as Record<string, unknown> | undefined
      return typeof query?.author === 'string' ? query.author : null
    }
    case 'get_commit': {
      // repo_full_name is always "owner/repo" — owner is the user being scored
      const repoFullName = payload?.repo_full_name
      if (typeof repoFullName === 'string') {
        const slash = repoFullName.indexOf('/')
        return slash > 0 ? repoFullName.slice(0, slash) : null
      }
      return null
    }
    default:
      return null
  }
}

const parseStreamEntry = (
  entry: unknown,
): { id: string; username: string | null } | null => {
  if (!Array.isArray(entry) || entry.length < 2) return null
  const id = entry[0]
  if (typeof id !== 'string') return null
  const fields = entry[1]
  if (!Array.isArray(fields)) return null

  for (let i = 0; i < fields.length; i += 2) {
    if (fields[i] === 'job' && typeof fields[i + 1] === 'string') {
      try {
        const req = JSON.parse(fields[i + 1]) as {
          kind?: string
          payload?: unknown
        }
        if (!req || typeof req.kind !== 'string') return { id, username: null }
        return {
          id,
          username: extractUsernameFromRequest({
            kind: req.kind,
            payload: req.payload ?? {},
          }),
        }
      } catch {
        return { id, username: null }
      }
    }
  }
  return { id, username: null }
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
    let knownConsumers = 0
    let onlineConsumers = 0
    let processedEntries: number | null = null
    let delayed = 0
    let delayedRetryAtMs: number | null = null
    let consumers: GitHubQueueConsumerSnapshot[] = []
    let recentUsernames: string[] = []
    let activeScoreUsernames: string[] = []

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
        knownConsumers = toNonNegativeInteger(group.consumers) ?? 0
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
              current_usernames: [],
            }
          })
          .sort((left, right) => right.pending - left.pending)

        knownConsumers = consumers.length
        onlineConsumers = consumers.filter(
          (consumer) => consumer.idle_ms <= ONLINE_CONSUMER_IDLE_MS,
        ).length
      } catch {
        markDegraded('Unable to read Redis consumer stats.')
      }

      // Block A: resolve which usernames each worker is currently processing
      if (pending > 0) {
        try {
          const rawPending = await client.call(
            'XPENDING',
            GITHUB_QUEUE_STREAM_KEY,
            GITHUB_QUEUE_GROUP_NAME,
            '-',
            '+',
            '20',
          )

          if (Array.isArray(rawPending) && rawPending.length > 0) {
            const consumerToIds = new Map<string, string[]>()
            const allIds: string[] = []

            for (const entry of rawPending) {
              if (!Array.isArray(entry) || entry.length < 2) continue
              const entryId = entry[0]
              const consumerName = entry[1]
              if (
                typeof entryId !== 'string' ||
                typeof consumerName !== 'string'
              )
                continue
              allIds.push(entryId)
              if (!consumerToIds.has(consumerName)) {
                consumerToIds.set(consumerName, [])
              }
              consumerToIds.get(consumerName)!.push(entryId)
            }

            if (allIds.length > 0) {
              const minId = allIds[0]
              const maxId = allIds[allIds.length - 1]
              const rawMessages = await client.call(
                'XRANGE',
                GITHUB_QUEUE_STREAM_KEY,
                minId,
                maxId,
              )

              const idToUsername = new Map<string, string>()
              if (Array.isArray(rawMessages)) {
                for (const entry of rawMessages) {
                  const parsed = parseStreamEntry(entry)
                  if (parsed?.username) {
                    idToUsername.set(parsed.id, parsed.username)
                  }
                }
              }

              const consumerToUsernames = new Map<string, string[]>()
              for (const [consumerName, ids] of consumerToIds) {
                const usernames = [
                  ...new Set(
                    ids
                      .map((id) => idToUsername.get(id))
                      .filter((u): u is string => Boolean(u)),
                  ),
                ]
                if (usernames.length > 0) {
                  consumerToUsernames.set(consumerName, usernames)
                }
              }

              consumers = consumers.map((consumer) => ({
                ...consumer,
                current_usernames:
                  consumerToUsernames.get(consumer.name) ??
                  consumer.current_usernames,
              }))
            }
          }
        } catch {
          // Best-effort — username data is not critical
        }
      }
    }

    // Block B: recent undelivered entries for queue preview
    try {
      const rawPreview = await client.call(
        'XREVRANGE',
        GITHUB_QUEUE_STREAM_KEY,
        '+',
        '-',
        'COUNT',
        '5',
      )
      if (Array.isArray(rawPreview)) {
        const seen = new Set<string>()
        for (const entry of rawPreview) {
          const parsed = parseStreamEntry(entry)
          if (parsed?.username && !seen.has(parsed.username)) {
            seen.add(parsed.username)
          }
        }
        recentUsernames = [...seen]
      }
    } catch {
      // Best-effort — preview data is not critical
    }

    // Block C: active score jobs (usernames being scored right now)
    try {
      const scoreKeys = await client.keys('ays:score:active:*')
      activeScoreUsernames = scoreKeys.map((key) =>
        key.slice('ays:score:active:'.length),
      )
    } catch {
      // Best-effort — active score data is not critical
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
        known_consumers: knownConsumers,
        online_consumers: onlineConsumers,
        active_consumers: onlineConsumers,
        processed_entries: processedEntries,
        next_retry_at: delayedRetryAtMs
          ? new Date(delayedRetryAtMs).toISOString()
          : null,
        next_retry_in_ms: delayedRetryAtMs
          ? Math.max(0, delayedRetryAtMs - Date.now())
          : null,
      },
      consumers,
      recent_usernames: recentUsernames,
      active_score_usernames: activeScoreUsernames,
    }

    return snapshot
  }

// Exported for unit testing
export { toNonNegativeInteger, parseDelayedRetryTimestamp }
