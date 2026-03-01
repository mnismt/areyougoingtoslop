import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import Redis from 'ioredis'
import {
  GitHubError,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from '../github/errors'
import {
  createRawGitHubClient,
  type GitHubRequestOptions,
} from '../github/raw-client'
import type {
  GitHubCommit,
  GitHubCommitSummary,
  GitHubEvent,
  GitHubRepo,
  GitHubUser,
} from '../github/types'

type GitHubQueueRequestKind =
  | 'get_user'
  | 'list_user_public_events'
  | 'list_user_repos'
  | 'list_repo_commits'
  | 'get_commit'

type GitHubQueueRequestPayloads = {
  get_user: {
    username: string
  }
  list_user_public_events: {
    username: string
    page: number
  }
  list_user_repos: {
    username: string
    page: number
  }
  list_repo_commits: {
    repo_full_name: string
    query: {
      author: string
      since: string
      until: string
      page: number
    }
  }
  get_commit: {
    repo_full_name: string
    sha: string
  }
}

type GitHubQueueRequestResults = {
  get_user: GitHubUser
  list_user_public_events: GitHubEvent[]
  list_user_repos: GitHubRepo[]
  list_repo_commits: GitHubCommitSummary[]
  get_commit: GitHubCommit
}

type GitHubQueueRequest<
  K extends GitHubQueueRequestKind = GitHubQueueRequestKind,
> = {
  request_id: string
  kind: K
  payload: GitHubQueueRequestPayloads[K]
  token?: string
  attempt: number
  enqueued_at: string
}

type SerializedQueueError = {
  name: string
  message: string
  status?: number
  reset_at?: string
}

type QueueResponseEnvelope =
  | {
      ok: true
      data: unknown
    }
  | {
      ok: false
      error: SerializedQueueError
    }

type QueueWorkerState = {
  commandClient: Redis | null
  started: boolean
  startPromise: Promise<void> | null
  metrics: QueueWorkerMetrics
  leaderCheckAt: number
}

type QueueWorkerMetrics = {
  worker_starts: number
  enqueued: number
  worker_processed: number
  responses_stored: number
  responses_consumed: number
  retries_scheduled: number
  timeouts: number
}

const DEFAULT_QUEUE_WORKER_METRICS: QueueWorkerMetrics = {
  worker_starts: 0,
  enqueued: 0,
  worker_processed: 0,
  responses_stored: 0,
  responses_consumed: 0,
  retries_scheduled: 0,
  timeouts: 0,
}

const normalizeQueueWorkerMetrics = (
  metrics?: Partial<QueueWorkerMetrics>,
): QueueWorkerMetrics => ({
  ...DEFAULT_QUEUE_WORKER_METRICS,
  ...(metrics ?? {}),
})

const parseIntegerEnv = (name: string, fallback: number) => {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

const parseBoundedIntegerEnv = (
  name: string,
  fallback: number,
  min: number,
  max: number,
) => {
  const parsed = parseIntegerEnv(name, fallback)
  return Math.min(max, Math.max(min, parsed))
}

const STREAM_KEY = 'ays:gh:req:stream'
const GROUP_NAME = 'ays:gh:req:workers'
const CONSUMER_PREFIX = 'ays-gh'
const DELAYED_ZSET_KEY = 'ays:gh:req:delayed'
const RESULT_KEY_PREFIX = 'ays:gh:req:reply:'
const RESULT_TTL_MS = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_RESULT_TTL_MS',
  60 * 1000,
  5 * 1000,
  10 * 60 * 1000,
)
const REQUEST_TIMEOUT_MS = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_REQUEST_TIMEOUT_MS',
  30 * 1000,
  5 * 1000,
  5 * 60 * 1000,
)
const WORKER_CONCURRENCY = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_WORKERS',
  4,
  1,
  12,
)
const MAX_ATTEMPTS = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_MAX_ATTEMPTS',
  4,
  1,
  12,
)
const RETRY_BASE_MS = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_RETRY_BASE_MS',
  350,
  100,
  5 * 1000,
)
const MAX_RETRY_DELAY_MS = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_MAX_RETRY_DELAY_MS',
  30 * 1000,
  1 * 1000,
  15 * 60 * 1000,
)
const SCHEDULER_BATCH_SIZE = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_SCHEDULER_BATCH',
  32,
  1,
  256,
)
const SCHEDULER_INTERVAL_MS = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_SCHEDULER_INTERVAL_MS',
  200,
  50,
  2 * 1000,
)
const STALE_RECLAIM_IDLE_MS = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_RECLAIM_IDLE_MS',
  20 * 1000,
  2 * 1000,
  30 * 60 * 1000,
)
const RECLAIM_INTERVAL_MS = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_RECLAIM_INTERVAL_MS',
  5 * 1000,
  250,
  60 * 1000,
)
const MAX_STREAM_LEN = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_MAX_STREAM_LEN',
  10_000,
  1_000,
  100_000,
)
const MAX_INFLIGHT = parseBoundedIntegerEnv(
  'GITHUB_QUEUE_MAX_INFLIGHT',
  100,
  10,
  1000,
)
const INFLIGHT_KEY = 'ays:gh:req:inflight'
const TOKEN_KEY_PREFIX = 'ays:gh:req:token:'
const LEADER_LOCK_KEY = 'ays:gh:req:leader'
const LEADER_LOCK_TTL_MS = 10_000
const LEADER_RENEW_MS = 4_000
const LEADER_CHECK_INTERVAL_MS = 15_000
const INSTANCE_ID = randomUUID()

export const GITHUB_QUEUE_STREAM_KEY = STREAM_KEY
export const GITHUB_QUEUE_GROUP_NAME = GROUP_NAME
export const GITHUB_QUEUE_DELAYED_ZSET_KEY = DELAYED_ZSET_KEY
export const GITHUB_QUEUE_WORKER_CONCURRENCY = WORKER_CONCURRENCY
export const GITHUB_QUEUE_LEADER_LOCK_KEY = LEADER_LOCK_KEY

const getWorkerState = (): QueueWorkerState => {
  const globalState = globalThis as typeof globalThis & {
    __aysGhQueueState?: Partial<QueueWorkerState>
  }
  if (!globalState.__aysGhQueueState) {
    globalState.__aysGhQueueState = {
      commandClient: null,
      started: false,
      startPromise: null,
      metrics: { ...DEFAULT_QUEUE_WORKER_METRICS },
      leaderCheckAt: 0,
    }
  } else {
    const current = globalState.__aysGhQueueState
    globalState.__aysGhQueueState = {
      commandClient: current.commandClient ?? null,
      started: current.started ?? false,
      startPromise: current.startPromise ?? null,
      metrics: normalizeQueueWorkerMetrics(current.metrics),
      leaderCheckAt: current.leaderCheckAt ?? 0,
    }
  }

  return globalState.__aysGhQueueState as QueueWorkerState
}

export const getGitHubQueueRuntimeMetrics = () => {
  const state = getWorkerState()
  const metrics = normalizeQueueWorkerMetrics(state.metrics)
  return {
    started: state.started,
    has_command_client: Boolean(state.commandClient),
    worker_starts: metrics.worker_starts,
    enqueued: metrics.enqueued,
    worker_processed: metrics.worker_processed,
    responses_stored: metrics.responses_stored,
    responses_consumed: metrics.responses_consumed,
    retries_scheduled: metrics.retries_scheduled,
    timeouts: metrics.timeouts,
  }
}

const getRedisUrl = () => {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) {
    return null
  }
  return redisUrl
}

const createRedisClient = (url: string) => {
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  })
}

const getCommandClient = () => {
  const state = getWorkerState()
  if (state.commandClient) {
    return state.commandClient
  }

  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    return null
  }

  const client = createRedisClient(redisUrl)
  state.commandClient = client
  return client
}

export const getGitHubQueueCommandClient = () => getCommandClient()

const isGitHubQueueRequestKind = (
  value: string,
): value is GitHubQueueRequestKind => {
  return (
    value === 'get_user' ||
    value === 'list_user_public_events' ||
    value === 'list_user_repos' ||
    value === 'list_repo_commits' ||
    value === 'get_commit'
  )
}

const parseQueueRequest = (raw: string): GitHubQueueRequest | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<GitHubQueueRequest>
    if (
      !parsed ||
      typeof parsed.request_id !== 'string' ||
      typeof parsed.kind !== 'string' ||
      !isGitHubQueueRequestKind(parsed.kind) ||
      typeof parsed.attempt !== 'number' ||
      !parsed.payload
    ) {
      return null
    }

    return parsed as GitHubQueueRequest
  } catch {
    return null
  }
}

const parseStreamFieldsToRequest = (
  fields: unknown,
): GitHubQueueRequest | null => {
  if (!Array.isArray(fields)) {
    return null
  }

  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i]
    const value = fields[i + 1]
    if (key === 'job' && typeof value === 'string') {
      return parseQueueRequest(value)
    }
  }

  return null
}

const parseXReadResponse = (
  response: unknown,
): Array<{ messageId: string; request: GitHubQueueRequest }> => {
  if (!Array.isArray(response)) {
    return []
  }

  const messages: Array<{ messageId: string; request: GitHubQueueRequest }> = []

  for (const streamResult of response) {
    if (!Array.isArray(streamResult) || streamResult.length < 2) {
      continue
    }
    const entries = streamResult[1]
    if (!Array.isArray(entries)) {
      continue
    }

    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2) {
        continue
      }
      const messageId = entry[0]
      if (typeof messageId !== 'string') {
        continue
      }

      const request = parseStreamFieldsToRequest(entry[1])
      if (!request) {
        continue
      }

      messages.push({ messageId, request })
    }
  }

  return messages
}

const parseXAutoClaimResponse = (
  response: unknown,
): Array<{ messageId: string; request: GitHubQueueRequest }> => {
  if (!Array.isArray(response) || response.length < 2) {
    return []
  }

  const entries = response[1]
  if (!Array.isArray(entries)) {
    return []
  }

  return parseXReadResponse([[STREAM_KEY, entries]])
}

const serializeQueueError = (error: unknown): SerializedQueueError => {
  if (error instanceof GitHubRateLimitError) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
      reset_at: error.resetAt,
    }
  }

  if (error instanceof GitHubNotFoundError) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
    }
  }

  if (error instanceof GitHubError) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message,
    }
  }

  return {
    name: 'Error',
    message: 'Unknown queue error',
  }
}

const restoreQueueError = (error: SerializedQueueError): Error => {
  if (error.name === 'GitHubRateLimitError') {
    return new GitHubRateLimitError(
      error.message,
      error.reset_at ?? new Date(Date.now() + 60_000).toISOString(),
      error.status,
    )
  }

  if (error.name === 'GitHubNotFoundError') {
    return new GitHubNotFoundError(error.message)
  }

  if (error.name === 'GitHubError') {
    return new GitHubError(error.message, error.status)
  }

  return new Error(error.message)
}

const isRetryableError = (error: SerializedQueueError) => {
  if (error.name === 'GitHubRateLimitError') {
    return true
  }

  const status = error.status
  if (status === undefined) {
    return true
  }

  return status === 429 || status >= 500
}

const computeRetryDelayMs = (error: SerializedQueueError, attempt: number) => {
  if (error.reset_at) {
    const resetAtMs = new Date(error.reset_at).getTime()
    if (!Number.isNaN(resetAtMs) && resetAtMs > Date.now()) {
      return Math.min(MAX_RETRY_DELAY_MS, resetAtMs - Date.now() + 250)
    }
  }

  const exponentialDelay = RETRY_BASE_MS * 2 ** attempt
  const jitter = Math.floor(Math.random() * 200)
  return Math.min(MAX_RETRY_DELAY_MS, exponentialDelay + jitter)
}

const resultKey = (requestId: string) => `${RESULT_KEY_PREFIX}${requestId}`

const storeQueueResponse = async (
  redis: Redis,
  requestId: string,
  response: QueueResponseEnvelope,
) => {
  const key = resultKey(requestId)
  const pipeline = redis.pipeline()
  pipeline.rpush(key, JSON.stringify(response))
  pipeline.pexpire(key, RESULT_TTL_MS)
  await pipeline.exec()
  const state = getWorkerState()
  state.metrics.responses_stored += 1
}

const executeQueueRequest = async (
  request: GitHubQueueRequest,
  token?: string,
): Promise<unknown> => {
  const client = createRawGitHubClient({ token })

  switch (request.kind) {
    case 'get_user': {
      const payload = request.payload as GitHubQueueRequestPayloads['get_user']
      return client.getUser(payload.username)
    }

    case 'list_user_public_events': {
      const payload =
        request.payload as GitHubQueueRequestPayloads['list_user_public_events']
      return client.listUserPublicEvents(payload.username, payload.page)
    }

    case 'list_user_repos': {
      const payload =
        request.payload as GitHubQueueRequestPayloads['list_user_repos']
      return client.listUserRepos(payload.username, payload.page)
    }

    case 'list_repo_commits': {
      const payload =
        request.payload as GitHubQueueRequestPayloads['list_repo_commits']
      return client.listRepoCommits(payload.repo_full_name, payload.query)
    }

    case 'get_commit': {
      const payload =
        request.payload as GitHubQueueRequestPayloads['get_commit']
      return client.getCommit(payload.repo_full_name, payload.sha)
    }
  }
}

const ackMessage = async (redis: Redis, messageId: string) => {
  await redis.xack(STREAM_KEY, GROUP_NAME, messageId)
}

const scheduleRetry = async (
  redis: Redis,
  request: GitHubQueueRequest,
  error: SerializedQueueError,
) => {
  const retryRequest: GitHubQueueRequest = {
    ...request,
    attempt: request.attempt + 1,
  }
  const retryAt = Date.now() + computeRetryDelayMs(error, request.attempt)

  await redis.zadd(
    DELAYED_ZSET_KEY,
    retryAt.toString(),
    JSON.stringify(retryRequest),
  )
  const state = getWorkerState()
  state.metrics.retries_scheduled += 1
}

const processQueueMessage = async (
  commandRedis: Redis,
  workerRedis: Redis,
  messageId: string,
  request: GitHubQueueRequest,
) => {
  const state = getWorkerState()
  state.metrics.worker_processed += 1

  let token: string | undefined = request.token
  const storedToken = await commandRedis.get(
    `${TOKEN_KEY_PREFIX}${request.request_id}`,
  )
  if (storedToken) {
    token = storedToken
  }

  try {
    const data = await executeQueueRequest(request, token)
    await storeQueueResponse(commandRedis, request.request_id, {
      ok: true,
      data,
    })
    await ackMessage(workerRedis, messageId)
    return
  } catch (error) {
    const serialized = serializeQueueError(error)
    const canRetry =
      request.attempt < MAX_ATTEMPTS && isRetryableError(serialized)

    if (canRetry) {
      await scheduleRetry(commandRedis, request, serialized)
      await ackMessage(workerRedis, messageId)
      return
    }

    await storeQueueResponse(commandRedis, request.request_id, {
      ok: false,
      error: serialized,
    })
    await ackMessage(workerRedis, messageId)
  }
}

const runWorkerLoop = async (
  commandRedis: Redis,
  workerRedis: Redis,
  consumerName: string,
) => {
  for (;;) {
    try {
      const rawMessages = await workerRedis.xreadgroup(
        'GROUP',
        GROUP_NAME,
        consumerName,
        'COUNT',
        1,
        'BLOCK',
        2000,
        'STREAMS',
        STREAM_KEY,
        '>',
      )

      const messages = parseXReadResponse(rawMessages)
      if (messages.length === 0) {
        continue
      }

      for (const message of messages) {
        await processQueueMessage(
          commandRedis,
          workerRedis,
          message.messageId,
          message.request,
        )
      }
    } catch (error) {
      console.warn('github_queue_worker_error', {
        message: error instanceof Error ? error.message : String(error),
      })
      await delay(500)
    }
  }
}

const SCHEDULER_IDLE_SLEEP_MS = 5_000

const runDelayedSchedulerLoop = async (commandRedis: Redis) => {
  for (;;) {
    try {
      const peeked = (await commandRedis.zrange(
        DELAYED_ZSET_KEY,
        0,
        0,
        'WITHSCORES',
      )) as string[]

      if (peeked.length === 0) {
        await delay(SCHEDULER_IDLE_SLEEP_MS)
        continue
      }

      const nextDueAt = Number(peeked[1])
      const now = Date.now()

      if (nextDueAt > now) {
        const sleepMs = Math.min(nextDueAt - now, SCHEDULER_IDLE_SLEEP_MS)
        await delay(sleepMs)
        continue
      }

      const duePayloads = (await commandRedis.zrangebyscore(
        DELAYED_ZSET_KEY,
        '-inf',
        now.toString(),
        'LIMIT',
        0,
        SCHEDULER_BATCH_SIZE,
      )) as string[]

      if (duePayloads.length === 0) {
        await delay(SCHEDULER_INTERVAL_MS)
        continue
      }

      for (const payload of duePayloads) {
        const removed = await commandRedis.zrem(DELAYED_ZSET_KEY, payload)
        if (removed === 0) {
          continue
        }

        await commandRedis.xadd(
          STREAM_KEY,
          'MAXLEN',
          '~',
          MAX_STREAM_LEN.toString(),
          '*',
          'job',
          payload,
        )
      }
    } catch (error) {
      console.warn('github_queue_scheduler_error', {
        message: error instanceof Error ? error.message : String(error),
      })
      await delay(800)
    }
  }
}

const RECLAIM_IDLE_SLEEP_MS = 30_000

const runPendingReclaimLoop = async (
  commandRedis: Redis,
  reclaimRedis: Redis,
  consumerName: string,
) => {
  for (;;) {
    try {
      const pendingSummary = (await commandRedis.xpending(
        STREAM_KEY,
        GROUP_NAME,
      )) as unknown[]
      const pendingCount =
        typeof pendingSummary?.[0] === 'number' ? pendingSummary[0] : 0
      if (pendingCount === 0) {
        await delay(RECLAIM_IDLE_SLEEP_MS)
        continue
      }

      const rawClaimed = await reclaimRedis.call(
        'XAUTOCLAIM',
        STREAM_KEY,
        GROUP_NAME,
        consumerName,
        STALE_RECLAIM_IDLE_MS,
        '0-0',
        'COUNT',
        16,
      )

      const claimed = parseXAutoClaimResponse(rawClaimed)
      for (const message of claimed) {
        await processQueueMessage(
          commandRedis,
          reclaimRedis,
          message.messageId,
          message.request,
        )
      }
    } catch (error) {
      console.warn('github_queue_reclaim_error', {
        message: error instanceof Error ? error.message : String(error),
      })
    }

    await delay(RECLAIM_INTERVAL_MS)
  }
}

const runForever = async (name: string, fn: () => Promise<void>) => {
  for (;;) {
    try {
      await fn()
    } catch (error) {
      console.error(`${name}_crashed`, {
        message: error instanceof Error ? error.message : String(error),
      })
      await delay(2_000)
    }
  }
}

const ensureConsumerGroup = async (redis: Redis) => {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '0', 'MKSTREAM')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('BUSYGROUP')) {
      throw error
    }
  }
}

const runLeaderRenewalLoop = async (commandRedis: Redis) => {
  for (;;) {
    await delay(LEADER_RENEW_MS)
    try {
      const renewed = await commandRedis.set(
        LEADER_LOCK_KEY,
        INSTANCE_ID,
        'PX',
        LEADER_LOCK_TTL_MS,
        'XX',
      )
      if (renewed !== 'OK') {
        console.warn('github_queue_leader_lost', { instance: INSTANCE_ID })
      }
    } catch (error) {
      console.warn('github_queue_leader_renew_error', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

const ensureQueueWorkersStarted = async () => {
  const state = getWorkerState()
  if (state.started) {
    return
  }

  if (state.startPromise) {
    await state.startPromise
    return
  }

  // Cooldown: don't spam leader lock attempts on every request
  const now = Date.now()
  if (
    state.leaderCheckAt > 0 &&
    now - state.leaderCheckAt < LEADER_CHECK_INTERVAL_MS
  ) {
    return
  }
  state.leaderCheckAt = now

  const commandRedis = getCommandClient()
  if (!commandRedis) {
    return
  }

  state.startPromise = (async () => {
    // Try to acquire leader lock (NX = only if not exists)
    const acquired = await commandRedis.set(
      LEADER_LOCK_KEY,
      INSTANCE_ID,
      'PX',
      LEADER_LOCK_TTL_MS,
      'NX',
    )

    if (acquired !== 'OK') {
      console.info('github_queue_leader_skipped', {
        reason: 'Another instance holds the worker lock.',
      })
      return
    }

    console.info('github_queue_leader_acquired', { instance: INSTANCE_ID })

    await ensureConsumerGroup(commandRedis)

    const workerConsumers: string[] = []
    for (let i = 0; i < WORKER_CONCURRENCY; i += 1) {
      workerConsumers.push(
        `${CONSUMER_PREFIX}-${i}-${randomUUID().slice(0, 6)}`,
      )
    }

    for (const consumerName of workerConsumers) {
      const workerRedis = commandRedis.duplicate({
        maxRetriesPerRequest: null,
      })

      void runForever(`github_queue_worker_${consumerName}`, () =>
        runWorkerLoop(commandRedis, workerRedis, consumerName),
      )
    }

    const schedulerRedis = commandRedis.duplicate({
      maxRetriesPerRequest: null,
    })
    void runForever('github_queue_scheduler', () =>
      runDelayedSchedulerLoop(schedulerRedis),
    )

    const reclaimRedis = commandRedis.duplicate({
      maxRetriesPerRequest: null,
    })
    const reclaimConsumer = `${CONSUMER_PREFIX}-reclaim-${randomUUID().slice(0, 6)}`
    void runForever('github_queue_reclaim', () =>
      runPendingReclaimLoop(commandRedis, reclaimRedis, reclaimConsumer),
    )

    // Start leader lock renewal
    void runForever('github_queue_leader_renew', () =>
      runLeaderRenewalLoop(commandRedis),
    )

    state.started = true
    state.metrics.worker_starts += 1
  })()

  try {
    await state.startPromise
  } finally {
    state.startPromise = null
  }
}

const waitForQueueResponse = async (requestId: string, timeoutMs: number) => {
  const commandRedis = getCommandClient()
  if (!commandRedis) {
    throw new GitHubError('GitHub queue unavailable: REDIS_URL is missing.')
  }

  const key = resultKey(requestId)
  const blockingRedis = commandRedis.duplicate({
    maxRetriesPerRequest: null,
  })

  try {
    await blockingRedis.connect()
    const timeoutSeconds = Math.ceil(timeoutMs / 1000)
    const result = await blockingRedis.blpop(key, timeoutSeconds)

    if (!result) {
      const state = getWorkerState()
      state.metrics.timeouts += 1
      throw new GitHubError(
        'GitHub request timed out while waiting for queue.',
        504,
      )
    }

    const parsed = JSON.parse(result[1]) as QueueResponseEnvelope
    const state = getWorkerState()
    state.metrics.responses_consumed += 1
    if (parsed.ok) {
      return parsed.data
    }
    throw restoreQueueError(parsed.error)
  } finally {
    await blockingRedis.quit()
  }
}

const enqueueAndWait = async <K extends GitHubQueueRequestKind>(
  kind: K,
  payload: GitHubQueueRequestPayloads[K],
  options: GitHubRequestOptions,
): Promise<GitHubQueueRequestResults[K]> => {
  const commandRedis = getCommandClient()
  if (!commandRedis) {
    throw new GitHubError('GitHub queue unavailable: REDIS_URL is missing.')
  }

  await ensureQueueWorkersStarted()

  const currentInflight = await commandRedis.incr(INFLIGHT_KEY)
  if (currentInflight > MAX_INFLIGHT) {
    await commandRedis.decr(INFLIGHT_KEY)
    throw new GitHubError('GitHub queue overloaded. Try again later.', 503)
  }

  try {
    const request: GitHubQueueRequest<K> = {
      request_id: randomUUID(),
      kind,
      payload,
      attempt: 0,
      enqueued_at: new Date().toISOString(),
    }

    if (options.token) {
      await commandRedis.set(
        `${TOKEN_KEY_PREFIX}${request.request_id}`,
        options.token,
        'PX',
        REQUEST_TIMEOUT_MS + 5000,
      )
    }

    await commandRedis.xadd(
      STREAM_KEY,
      'MAXLEN',
      '~',
      MAX_STREAM_LEN.toString(),
      '*',
      'job',
      JSON.stringify(request),
    )
    const state = getWorkerState()
    state.metrics.enqueued += 1

    const data = await waitForQueueResponse(
      request.request_id,
      REQUEST_TIMEOUT_MS,
    )
    return data as GitHubQueueRequestResults[K]
  } finally {
    await commandRedis.decr(INFLIGHT_KEY).catch(() => {})
  }
}

export const isGitHubRequestQueueEnabled = () => {
  return Boolean(getRedisUrl())
}

export const createQueuedGitHubClient = (options: GitHubRequestOptions) => ({
  getUser: (username: string) =>
    enqueueAndWait('get_user', { username }, options),
  listUserPublicEvents: (username: string, page: number) =>
    enqueueAndWait('list_user_public_events', { username, page }, options),
  listUserRepos: (username: string, page: number) =>
    enqueueAndWait('list_user_repos', { username, page }, options),
  listRepoCommits: (
    repoFullName: string,
    query: {
      author: string
      since: string
      until: string
      page: number
    },
  ) =>
    enqueueAndWait(
      'list_repo_commits',
      {
        repo_full_name: repoFullName,
        query,
      },
      options,
    ),
  getCommit: (repoFullName: string, sha: string) =>
    enqueueAndWait(
      'get_commit',
      {
        repo_full_name: repoFullName,
        sha,
      },
      options,
    ),
})

export {
  parseQueueRequest,
  parseStreamFieldsToRequest,
  parseXReadResponse,
  parseXAutoClaimResponse,
  serializeQueueError,
  restoreQueueError,
  isRetryableError,
  computeRetryDelayMs,
}
