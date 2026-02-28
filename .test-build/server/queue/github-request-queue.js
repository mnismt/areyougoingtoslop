"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueuedGitHubClient = exports.isGitHubRequestQueueEnabled = void 0;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:timers/promises");
const ioredis_1 = __importDefault(require("ioredis"));
const errors_1 = require("../github/errors");
const raw_client_1 = require("../github/raw-client");
const parseIntegerEnv = (name, fallback) => {
    const raw = process.env[name];
    if (!raw) {
        return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};
const parseBoundedIntegerEnv = (name, fallback, min, max) => {
    const parsed = parseIntegerEnv(name, fallback);
    return Math.min(max, Math.max(min, parsed));
};
const STREAM_KEY = 'ays:gh:req:stream';
const GROUP_NAME = 'ays:gh:req:workers';
const CONSUMER_PREFIX = 'ays-gh';
const DELAYED_ZSET_KEY = 'ays:gh:req:delayed';
const RESULT_KEY_PREFIX = 'ays:gh:req:result:';
const RESULT_TTL_MS = parseBoundedIntegerEnv('GITHUB_QUEUE_RESULT_TTL_MS', 60 * 1000, 5 * 1000, 10 * 60 * 1000);
const REQUEST_TIMEOUT_MS = parseBoundedIntegerEnv('GITHUB_QUEUE_REQUEST_TIMEOUT_MS', 30 * 1000, 5 * 1000, 5 * 60 * 1000);
const WORKER_CONCURRENCY = parseBoundedIntegerEnv('GITHUB_QUEUE_WORKERS', 4, 1, 12);
const MAX_ATTEMPTS = parseBoundedIntegerEnv('GITHUB_QUEUE_MAX_ATTEMPTS', 4, 1, 12);
const RETRY_BASE_MS = parseBoundedIntegerEnv('GITHUB_QUEUE_RETRY_BASE_MS', 350, 100, 5 * 1000);
const MAX_RETRY_DELAY_MS = parseBoundedIntegerEnv('GITHUB_QUEUE_MAX_RETRY_DELAY_MS', 30 * 1000, 1 * 1000, 15 * 60 * 1000);
const SCHEDULER_BATCH_SIZE = parseBoundedIntegerEnv('GITHUB_QUEUE_SCHEDULER_BATCH', 32, 1, 256);
const SCHEDULER_INTERVAL_MS = parseBoundedIntegerEnv('GITHUB_QUEUE_SCHEDULER_INTERVAL_MS', 200, 50, 2 * 1000);
const STALE_RECLAIM_IDLE_MS = parseBoundedIntegerEnv('GITHUB_QUEUE_RECLAIM_IDLE_MS', 20 * 1000, 2 * 1000, 30 * 60 * 1000);
const RECLAIM_INTERVAL_MS = parseBoundedIntegerEnv('GITHUB_QUEUE_RECLAIM_INTERVAL_MS', 5 * 1000, 250, 60 * 1000);
const getWorkerState = () => {
    const globalState = globalThis;
    if (!globalState.__aysGhQueueState) {
        globalState.__aysGhQueueState = {
            commandClient: null,
            started: false,
            startPromise: null,
        };
    }
    return globalState.__aysGhQueueState;
};
const getRedisUrl = () => {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
        return null;
    }
    return redisUrl;
};
const createRedisClient = (url) => {
    return new ioredis_1.default(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: true,
    });
};
const getCommandClient = () => {
    const state = getWorkerState();
    if (state.commandClient) {
        return state.commandClient;
    }
    const redisUrl = getRedisUrl();
    if (!redisUrl) {
        return null;
    }
    const client = createRedisClient(redisUrl);
    state.commandClient = client;
    return client;
};
const isGitHubQueueRequestKind = (value) => {
    return (value === 'get_user' ||
        value === 'list_user_public_events' ||
        value === 'list_user_repos' ||
        value === 'list_repo_commits' ||
        value === 'get_commit');
};
const parseQueueRequest = (raw) => {
    try {
        const parsed = JSON.parse(raw);
        if (!parsed ||
            typeof parsed.request_id !== 'string' ||
            typeof parsed.kind !== 'string' ||
            !isGitHubQueueRequestKind(parsed.kind) ||
            typeof parsed.attempt !== 'number' ||
            !parsed.payload) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
};
const parseStreamFieldsToRequest = (fields) => {
    if (!Array.isArray(fields)) {
        return null;
    }
    for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const value = fields[i + 1];
        if (key === 'job' && typeof value === 'string') {
            return parseQueueRequest(value);
        }
    }
    return null;
};
const parseXReadResponse = (response) => {
    if (!Array.isArray(response)) {
        return [];
    }
    const messages = [];
    for (const streamResult of response) {
        if (!Array.isArray(streamResult) || streamResult.length < 2) {
            continue;
        }
        const entries = streamResult[1];
        if (!Array.isArray(entries)) {
            continue;
        }
        for (const entry of entries) {
            if (!Array.isArray(entry) || entry.length < 2) {
                continue;
            }
            const messageId = entry[0];
            if (typeof messageId !== 'string') {
                continue;
            }
            const request = parseStreamFieldsToRequest(entry[1]);
            if (!request) {
                continue;
            }
            messages.push({ messageId, request });
        }
    }
    return messages;
};
const parseXAutoClaimResponse = (response) => {
    if (!Array.isArray(response) || response.length < 2) {
        return [];
    }
    const entries = response[1];
    if (!Array.isArray(entries)) {
        return [];
    }
    return parseXReadResponse([[STREAM_KEY, entries]]);
};
const serializeQueueError = (error) => {
    if (error instanceof errors_1.GitHubRateLimitError) {
        return {
            name: error.name,
            message: error.message,
            status: error.status,
            reset_at: error.resetAt,
        };
    }
    if (error instanceof errors_1.GitHubNotFoundError) {
        return {
            name: error.name,
            message: error.message,
            status: error.status,
        };
    }
    if (error instanceof errors_1.GitHubError) {
        return {
            name: error.name,
            message: error.message,
            status: error.status,
        };
    }
    if (error instanceof Error) {
        return {
            name: error.name || 'Error',
            message: error.message,
        };
    }
    return {
        name: 'Error',
        message: 'Unknown queue error',
    };
};
const restoreQueueError = (error) => {
    if (error.name === 'GitHubRateLimitError') {
        return new errors_1.GitHubRateLimitError(error.message, error.reset_at ?? new Date(Date.now() + 60000).toISOString(), error.status);
    }
    if (error.name === 'GitHubNotFoundError') {
        return new errors_1.GitHubNotFoundError(error.message);
    }
    if (error.name === 'GitHubError') {
        return new errors_1.GitHubError(error.message, error.status);
    }
    return new Error(error.message);
};
const isRetryableError = (error) => {
    if (error.name === 'GitHubRateLimitError') {
        return true;
    }
    const status = error.status;
    if (status === undefined) {
        return true;
    }
    return status === 429 || status >= 500;
};
const computeRetryDelayMs = (error, attempt) => {
    if (error.reset_at) {
        const resetAtMs = new Date(error.reset_at).getTime();
        if (!Number.isNaN(resetAtMs) && resetAtMs > Date.now()) {
            return Math.min(MAX_RETRY_DELAY_MS, resetAtMs - Date.now() + 250);
        }
    }
    const exponentialDelay = RETRY_BASE_MS * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 200);
    return Math.min(MAX_RETRY_DELAY_MS, exponentialDelay + jitter);
};
const resultKey = (requestId) => `${RESULT_KEY_PREFIX}${requestId}`;
const storeQueueResponse = async (redis, requestId, response) => {
    await redis.set(resultKey(requestId), JSON.stringify(response), 'PX', RESULT_TTL_MS);
};
const executeQueueRequest = async (request) => {
    const client = (0, raw_client_1.createRawGitHubClient)({ token: request.token });
    switch (request.kind) {
        case 'get_user': {
            const payload = request.payload;
            return client.getUser(payload.username);
        }
        case 'list_user_public_events': {
            const payload = request.payload;
            return client.listUserPublicEvents(payload.username, payload.page);
        }
        case 'list_user_repos': {
            const payload = request.payload;
            return client.listUserRepos(payload.username, payload.page);
        }
        case 'list_repo_commits': {
            const payload = request.payload;
            return client.listRepoCommits(payload.repo_full_name, payload.query);
        }
        case 'get_commit': {
            const payload = request.payload;
            return client.getCommit(payload.repo_full_name, payload.sha);
        }
    }
};
const ackMessage = async (redis, messageId) => {
    await redis.xack(STREAM_KEY, GROUP_NAME, messageId);
};
const scheduleRetry = async (redis, request, error) => {
    const retryRequest = {
        ...request,
        attempt: request.attempt + 1,
    };
    const retryAt = Date.now() + computeRetryDelayMs(error, request.attempt);
    await redis.zadd(DELAYED_ZSET_KEY, retryAt.toString(), JSON.stringify(retryRequest));
};
const processQueueMessage = async (commandRedis, workerRedis, messageId, request) => {
    try {
        const data = await executeQueueRequest(request);
        await storeQueueResponse(commandRedis, request.request_id, {
            ok: true,
            data,
        });
        await ackMessage(workerRedis, messageId);
        return;
    }
    catch (error) {
        const serialized = serializeQueueError(error);
        const canRetry = request.attempt < MAX_ATTEMPTS && isRetryableError(serialized);
        if (canRetry) {
            await scheduleRetry(commandRedis, request, serialized);
            await ackMessage(workerRedis, messageId);
            return;
        }
        await storeQueueResponse(commandRedis, request.request_id, {
            ok: false,
            error: serialized,
        });
        await ackMessage(workerRedis, messageId);
    }
};
const runWorkerLoop = async (commandRedis, workerRedis, consumerName) => {
    for (;;) {
        try {
            const rawMessages = await workerRedis.xreadgroup('GROUP', GROUP_NAME, consumerName, 'COUNT', 1, 'BLOCK', 2000, 'STREAMS', STREAM_KEY, '>');
            const messages = parseXReadResponse(rawMessages);
            if (messages.length === 0) {
                continue;
            }
            for (const message of messages) {
                await processQueueMessage(commandRedis, workerRedis, message.messageId, message.request);
            }
        }
        catch (error) {
            console.warn('github_queue_worker_error', {
                message: error instanceof Error ? error.message : String(error),
            });
            await (0, promises_1.setTimeout)(500);
        }
    }
};
const runDelayedSchedulerLoop = async (commandRedis) => {
    for (;;) {
        try {
            const duePayloads = (await commandRedis.zrangebyscore(DELAYED_ZSET_KEY, '-inf', Date.now().toString(), 'LIMIT', 0, SCHEDULER_BATCH_SIZE));
            if (duePayloads.length === 0) {
                await (0, promises_1.setTimeout)(SCHEDULER_INTERVAL_MS);
                continue;
            }
            for (const payload of duePayloads) {
                const removed = await commandRedis.zrem(DELAYED_ZSET_KEY, payload);
                if (removed === 0) {
                    continue;
                }
                await commandRedis.xadd(STREAM_KEY, '*', 'job', payload);
            }
        }
        catch (error) {
            console.warn('github_queue_scheduler_error', {
                message: error instanceof Error ? error.message : String(error),
            });
            await (0, promises_1.setTimeout)(800);
        }
    }
};
const runPendingReclaimLoop = async (commandRedis, reclaimRedis, consumerName) => {
    for (;;) {
        try {
            const rawClaimed = await reclaimRedis.call('XAUTOCLAIM', STREAM_KEY, GROUP_NAME, consumerName, STALE_RECLAIM_IDLE_MS, '0-0', 'COUNT', 16);
            const claimed = parseXAutoClaimResponse(rawClaimed);
            for (const message of claimed) {
                await processQueueMessage(commandRedis, reclaimRedis, message.messageId, message.request);
            }
        }
        catch (error) {
            console.warn('github_queue_reclaim_error', {
                message: error instanceof Error ? error.message : String(error),
            });
        }
        await (0, promises_1.setTimeout)(RECLAIM_INTERVAL_MS);
    }
};
const ensureConsumerGroup = async (redis) => {
    try {
        await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '0', 'MKSTREAM');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('BUSYGROUP')) {
            throw error;
        }
    }
};
const ensureQueueWorkersStarted = async () => {
    const state = getWorkerState();
    if (state.started) {
        return;
    }
    if (state.startPromise) {
        await state.startPromise;
        return;
    }
    const commandRedis = getCommandClient();
    if (!commandRedis) {
        return;
    }
    state.startPromise = (async () => {
        await ensureConsumerGroup(commandRedis);
        const workerConsumers = [];
        for (let i = 0; i < WORKER_CONCURRENCY; i += 1) {
            workerConsumers.push(`${CONSUMER_PREFIX}-${i}-${(0, node_crypto_1.randomUUID)().slice(0, 6)}`);
        }
        for (const consumerName of workerConsumers) {
            const workerRedis = commandRedis.duplicate({
                maxRetriesPerRequest: null,
            });
            void runWorkerLoop(commandRedis, workerRedis, consumerName);
        }
        const schedulerRedis = commandRedis.duplicate({
            maxRetriesPerRequest: null,
        });
        void runDelayedSchedulerLoop(schedulerRedis);
        const reclaimRedis = commandRedis.duplicate({
            maxRetriesPerRequest: null,
        });
        const reclaimConsumer = `${CONSUMER_PREFIX}-reclaim-${(0, node_crypto_1.randomUUID)().slice(0, 6)}`;
        void runPendingReclaimLoop(commandRedis, reclaimRedis, reclaimConsumer);
        state.started = true;
    })();
    try {
        await state.startPromise;
    }
    finally {
        state.startPromise = null;
    }
};
const waitForQueueResponse = async (requestId, timeoutMs) => {
    const commandRedis = getCommandClient();
    if (!commandRedis) {
        throw new errors_1.GitHubError('GitHub queue unavailable: REDIS_URL is missing.');
    }
    const deadline = Date.now() + timeoutMs;
    const key = resultKey(requestId);
    for (;;) {
        const raw = await commandRedis.get(key);
        if (raw) {
            await commandRedis.del(key);
            const parsed = JSON.parse(raw);
            if (parsed.ok) {
                return parsed.data;
            }
            throw restoreQueueError(parsed.error);
        }
        if (Date.now() >= deadline) {
            throw new errors_1.GitHubError('GitHub request timed out while waiting for queue.', 504);
        }
        await (0, promises_1.setTimeout)(50);
    }
};
const enqueueAndWait = async (kind, payload, options) => {
    const commandRedis = getCommandClient();
    if (!commandRedis) {
        throw new errors_1.GitHubError('GitHub queue unavailable: REDIS_URL is missing.');
    }
    await ensureQueueWorkersStarted();
    const request = {
        request_id: (0, node_crypto_1.randomUUID)(),
        kind,
        payload,
        token: options.token,
        attempt: 0,
        enqueued_at: new Date().toISOString(),
    };
    await commandRedis.xadd(STREAM_KEY, '*', 'job', JSON.stringify(request));
    const data = await waitForQueueResponse(request.request_id, REQUEST_TIMEOUT_MS);
    return data;
};
const isGitHubRequestQueueEnabled = () => {
    return Boolean(getRedisUrl());
};
exports.isGitHubRequestQueueEnabled = isGitHubRequestQueueEnabled;
const createQueuedGitHubClient = (options) => ({
    getUser: (username) => enqueueAndWait('get_user', { username }, options),
    listUserPublicEvents: (username, page) => enqueueAndWait('list_user_public_events', { username, page }, options),
    listUserRepos: (username, page) => enqueueAndWait('list_user_repos', { username, page }, options),
    listRepoCommits: (repoFullName, query) => enqueueAndWait('list_repo_commits', {
        repo_full_name: repoFullName,
        query,
    }, options),
    getCommit: (repoFullName, sha) => enqueueAndWait('get_commit', {
        repo_full_name: repoFullName,
        sha,
    }, options),
});
exports.createQueuedGitHubClient = createQueuedGitHubClient;
