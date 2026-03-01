"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitHubQueueSnapshot = exports.parseRedisInfoRows = void 0;
const client_1 = require("../github/client");
const github_request_queue_1 = require("./github-request-queue");
const toRedisInfoRow = (value) => {
    if (Array.isArray(value)) {
        const row = {};
        for (let index = 0; index < value.length; index += 2) {
            const key = value[index];
            const entryValue = value[index + 1];
            if (typeof key !== 'string') {
                continue;
            }
            row[key] = entryValue;
        }
        return row;
    }
    if (typeof value === 'object' && value !== null) {
        return value;
    }
    return null;
};
const parseRedisInfoRows = (input) => {
    if (!Array.isArray(input)) {
        return [];
    }
    const rows = [];
    for (const value of input) {
        const row = toRedisInfoRow(value);
        if (!row) {
            continue;
        }
        rows.push(row);
    }
    return rows;
};
exports.parseRedisInfoRows = parseRedisInfoRows;
const toNonNegativeInteger = (value) => {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return null;
        }
        return Math.max(0, Math.trunc(value));
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) {
            return null;
        }
        return Math.max(0, parsed);
    }
    return null;
};
const parseDelayedRetryTimestamp = (raw) => {
    if (!Array.isArray(raw) || raw.length === 0) {
        return null;
    }
    const first = raw[0];
    if (Array.isArray(first) && first.length >= 2) {
        return toNonNegativeInteger(first[1]);
    }
    if (raw.length >= 2) {
        return toNonNegativeInteger(raw[1]);
    }
    return null;
};
const createSnapshotBase = (generatedAt, health, warnings = []) => ({
    enabled: health !== 'disabled',
    health,
    generated_at: generatedAt,
    warnings,
    client_selection: (0, client_1.getGitHubClientSelectionStats)(),
    runtime: (0, github_request_queue_1.getGitHubQueueRuntimeMetrics)(),
    queue: {
        workers_configured: github_request_queue_1.GITHUB_QUEUE_WORKER_CONCURRENCY,
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
});
const isMissingKeyError = (error) => {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes('no such key');
};
const getGitHubQueueSnapshot = async () => {
    const generatedAt = new Date().toISOString();
    if (!(0, github_request_queue_1.isGitHubRequestQueueEnabled)()) {
        return createSnapshotBase(generatedAt, 'disabled', [
            'Queue mode disabled. Set REDIS_URL to enable centralized GitHub queueing.',
        ]);
    }
    const client = (0, github_request_queue_1.getGitHubQueueCommandClient)();
    if (!client) {
        return createSnapshotBase(generatedAt, 'disabled', [
            'Queue mode disabled. Set REDIS_URL to enable centralized GitHub queueing.',
        ]);
    }
    const warnings = [];
    let health = 'ok';
    let streamInitialized = false;
    let lag = null;
    let pending = 0;
    let activeConsumers = 0;
    let processedEntries = null;
    let delayed = 0;
    let delayedRetryAtMs = null;
    let consumers = [];
    const markDegraded = (warning) => {
        health = 'degraded';
        warnings.push(warning);
    };
    try {
        const rawGroups = await client.call('XINFO', 'GROUPS', github_request_queue_1.GITHUB_QUEUE_STREAM_KEY);
        const groups = (0, exports.parseRedisInfoRows)(rawGroups);
        const group = groups.find((entry) => typeof entry.name === 'string' &&
            entry.name === github_request_queue_1.GITHUB_QUEUE_GROUP_NAME);
        if (group) {
            streamInitialized = true;
            lag = toNonNegativeInteger(group.lag);
            pending = toNonNegativeInteger(group.pending) ?? 0;
            activeConsumers = toNonNegativeInteger(group.consumers) ?? 0;
            processedEntries =
                toNonNegativeInteger(group['entries-read']) ??
                    toNonNegativeInteger(group.entries_read) ??
                    toNonNegativeInteger(group.entriesRead);
        }
    }
    catch (error) {
        if (!isMissingKeyError(error)) {
            markDegraded('Unable to read Redis stream group stats.');
        }
    }
    if (streamInitialized) {
        try {
            const rawConsumers = await client.call('XINFO', 'CONSUMERS', github_request_queue_1.GITHUB_QUEUE_STREAM_KEY, github_request_queue_1.GITHUB_QUEUE_GROUP_NAME);
            consumers = (0, exports.parseRedisInfoRows)(rawConsumers)
                .map((entry) => {
                return {
                    name: typeof entry.name === 'string'
                        ? entry.name
                        : 'unknown-consumer',
                    pending: toNonNegativeInteger(entry.pending) ?? 0,
                    idle_ms: toNonNegativeInteger(entry.idle) ?? 0,
                    inactive_ms: toNonNegativeInteger(entry.inactive),
                };
            })
                .sort((left, right) => right.pending - left.pending);
            if (consumers.length > 0) {
                activeConsumers = consumers.length;
            }
        }
        catch {
            markDegraded('Unable to read Redis consumer stats.');
        }
    }
    try {
        delayed = await client.zcard(github_request_queue_1.GITHUB_QUEUE_DELAYED_ZSET_KEY);
    }
    catch {
        markDegraded('Unable to read delayed retry depth.');
    }
    try {
        const rawNextRetry = await client.zrange(github_request_queue_1.GITHUB_QUEUE_DELAYED_ZSET_KEY, 0, 0, 'WITHSCORES');
        delayedRetryAtMs = parseDelayedRetryTimestamp(rawNextRetry);
    }
    catch {
        markDegraded('Unable to read next retry timestamp.');
    }
    if (!streamInitialized && health === 'ok') {
        warnings.push('Queue stream is idle. Start a score job to initialize workers.');
    }
    const snapshot = {
        enabled: true,
        health,
        generated_at: generatedAt,
        warnings,
        client_selection: (0, client_1.getGitHubClientSelectionStats)(),
        runtime: (0, github_request_queue_1.getGitHubQueueRuntimeMetrics)(),
        queue: {
            workers_configured: github_request_queue_1.GITHUB_QUEUE_WORKER_CONCURRENCY,
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
    };
    return snapshot;
};
exports.getGitHubQueueSnapshot = getGitHubQueueSnapshot;
