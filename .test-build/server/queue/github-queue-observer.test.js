"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const github_queue_observer_1 = require("./github-queue-observer");
(0, node_test_1.describe)('parseRedisInfoRows', () => {
    (0, node_test_1.it)('normalizes pair-array rows into objects', () => {
        const rows = (0, github_queue_observer_1.parseRedisInfoRows)([
            ['name', 'ays:gh:req:workers', 'pending', '7', 'lag', 3],
        ]);
        strict_1.default.equal(rows.length, 1);
        strict_1.default.equal(rows[0]?.name, 'ays:gh:req:workers');
        strict_1.default.equal(rows[0]?.pending, '7');
        strict_1.default.equal(rows[0]?.lag, 3);
    });
    (0, node_test_1.it)('passes through object rows', () => {
        const rows = (0, github_queue_observer_1.parseRedisInfoRows)([
            {
                name: 'ays-gh-1',
                pending: 2,
                idle: 120,
            },
        ]);
        strict_1.default.equal(rows.length, 1);
        strict_1.default.equal(rows[0]?.name, 'ays-gh-1');
        strict_1.default.equal(rows[0]?.pending, 2);
    });
});
(0, node_test_1.describe)('getGitHubQueueSnapshot', () => {
    (0, node_test_1.it)('returns disabled snapshot when REDIS_URL is missing', async () => {
        const previousRedisUrl = process.env.REDIS_URL;
        process.env.REDIS_URL = '';
        try {
            const snapshot = await (0, github_queue_observer_1.getGitHubQueueSnapshot)();
            strict_1.default.equal(snapshot.enabled, false);
            strict_1.default.equal(snapshot.health, 'disabled');
            strict_1.default.equal(snapshot.queue.workers_configured > 0, true);
        }
        finally {
            process.env.REDIS_URL = previousRedisUrl;
        }
    });
});
