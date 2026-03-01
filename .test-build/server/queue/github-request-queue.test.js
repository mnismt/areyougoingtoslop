"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const github_request_queue_1 = require("./github-request-queue");
(0, node_test_1.describe)('getGitHubQueueRuntimeMetrics', () => {
    (0, node_test_1.it)('normalizes legacy worker state without metrics', () => {
        const runtime = globalThis;
        const previous = runtime.__aysGhQueueState;
        runtime.__aysGhQueueState = {
            commandClient: null,
            started: true,
            startPromise: null,
        };
        try {
            const metrics = (0, github_request_queue_1.getGitHubQueueRuntimeMetrics)();
            strict_1.default.equal(metrics.started, true);
            strict_1.default.equal(metrics.worker_starts, 0);
            strict_1.default.equal(metrics.enqueued, 0);
            strict_1.default.equal(metrics.worker_processed, 0);
            strict_1.default.equal(metrics.responses_stored, 0);
            strict_1.default.equal(metrics.responses_consumed, 0);
            strict_1.default.equal(metrics.retries_scheduled, 0);
            strict_1.default.equal(metrics.timeouts, 0);
        }
        finally {
            runtime.__aysGhQueueState = previous;
        }
    });
    (0, node_test_1.it)('backfills missing metric fields while preserving existing counters', () => {
        const runtime = globalThis;
        const previous = runtime.__aysGhQueueState;
        runtime.__aysGhQueueState = {
            commandClient: null,
            started: false,
            startPromise: null,
            metrics: {
                enqueued: 12,
            },
        };
        try {
            const metrics = (0, github_request_queue_1.getGitHubQueueRuntimeMetrics)();
            strict_1.default.equal(metrics.started, false);
            strict_1.default.equal(metrics.enqueued, 12);
            strict_1.default.equal(metrics.worker_starts, 0);
            strict_1.default.equal(metrics.responses_stored, 0);
            strict_1.default.equal(metrics.timeouts, 0);
        }
        finally {
            runtime.__aysGhQueueState = previous;
        }
    });
});
