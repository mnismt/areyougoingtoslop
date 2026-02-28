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
}

const STREAM_KEY = 'ays:gh:req:stream'
const GROUP_NAME = 'ays:gh:req:workers'
const CONSUMER_PREFIX = 'ays-gh'
const DELAYED_ZSET_KEY = 'ays:gh:req:delayed'
const RESULT_KEY_PREFIX = 'ays:gh:req:result:'
const RESULT_TTL_MS = 60 * 1000
const REQUEST_TIMEOUT_MS = 30 * 1000
const WORKER_CONCURRENCY = 4
const MAX_ATTEMPTS = 4
const RETRY_BASE_MS = 350
const MAX_RETRY_DELAY_MS = 30 * 1000
const SCHEDULER_BATCH_SIZE = 32
const SCHEDULER_INTERVAL_MS = 200
const STALE_RECLAIM_IDLE_MS = 20 * 1000
const RECLAIM_INTERVAL_MS = 5 * 1000

const getWorkerState = (): QueueWorkerState => {
  const globalState = globalThis as typeof globalThis & {
    __aysGhQueueState?: QueueWorkerState
  }
  if (!globalState.__aysGhQueueState) {
    globalState.__aysGhQueueState = {
      commandClient: null,
      started: false,
      startPromise: null,
    }
  }
  return globalState.__aysGhQueueState
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
  await redis.set(
    resultKey(requestId),
    JSON.stringify(response),
    'PX',
    RESULT_TTL_MS,
  )
}

const executeQueueRequest = async (
  request: GitHubQueueRequest,
): Promise<unknown> => {
  const client = createRawGitHubClient({ token: request.token })

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
}

const processQueueMessage = async (
  commandRedis: Redis,
  workerRedis: Redis,
  messageId: string,
  request: GitHubQueueRequest,
) => {
  try {
    const data = await executeQueueRequest(request)
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

const runDelayedSchedulerLoop = async (commandRedis: Redis) => {
  for (;;) {
    try {
      const duePayloads = (await commandRedis.zrangebyscore(
        DELAYED_ZSET_KEY,
        '-inf',
        Date.now().toString(),
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

        await commandRedis.xadd(STREAM_KEY, '*', 'job', payload)
      }
    } catch (error) {
      console.warn('github_queue_scheduler_error', {
        message: error instanceof Error ? error.message : String(error),
      })
      await delay(800)
    }
  }
}

const runPendingReclaimLoop = async (
  commandRedis: Redis,
  reclaimRedis: Redis,
  consumerName: string,
) => {
  for (;;) {
    try {
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

const ensureQueueWorkersStarted = async () => {
  const state = getWorkerState()
  if (state.started) {
    return
  }

  if (state.startPromise) {
    await state.startPromise
    return
  }

  const commandRedis = getCommandClient()
  if (!commandRedis) {
    return
  }

  state.startPromise = (async () => {
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

      void runWorkerLoop(commandRedis, workerRedis, consumerName)
    }

    const schedulerRedis = commandRedis.duplicate({
      maxRetriesPerRequest: null,
    })
    void runDelayedSchedulerLoop(schedulerRedis)

    const reclaimRedis = commandRedis.duplicate({
      maxRetriesPerRequest: null,
    })
    const reclaimConsumer = `${CONSUMER_PREFIX}-reclaim-${randomUUID().slice(0, 6)}`
    void runPendingReclaimLoop(commandRedis, reclaimRedis, reclaimConsumer)

    state.started = true
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

  const deadline = Date.now() + timeoutMs
  const key = resultKey(requestId)

  for (;;) {
    const raw = await commandRedis.get(key)
    if (raw) {
      await commandRedis.del(key)
      const parsed = JSON.parse(raw) as QueueResponseEnvelope
      if (parsed.ok) {
        return parsed.data
      }
      throw restoreQueueError(parsed.error)
    }

    if (Date.now() >= deadline) {
      throw new GitHubError(
        'GitHub request timed out while waiting for queue.',
        504,
      )
    }

    await delay(50)
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

  const request: GitHubQueueRequest<K> = {
    request_id: randomUUID(),
    kind,
    payload,
    token: options.token,
    attempt: 0,
    enqueued_at: new Date().toISOString(),
  }

  await commandRedis.xadd(STREAM_KEY, '*', 'job', JSON.stringify(request))

  const data = await waitForQueueResponse(
    request.request_id,
    REQUEST_TIMEOUT_MS,
  )
  return data as GitHubQueueRequestResults[K]
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
