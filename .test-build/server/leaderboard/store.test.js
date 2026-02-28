"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = require("node:test");
const store_1 = require("./store");
const createStoragePath = async () => {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join(node_os_1.default.tmpdir(), 'leaderboard-'));
    return node_path_1.default.join(dir, 'leaderboard.json');
};
(0, node_test_1.describe)('leaderboard store', () => {
    (0, node_test_1.it)('stores and retrieves entries', async () => {
        const storagePath = await createStoragePath();
        const now = new Date('2026-02-23T00:00:00.000Z');
        await (0, store_1.upsertLeaderboardEntry)({
            username: 'octocat',
            slop_score: 72,
            tier: 'The Agent Supervisor',
            confidence: 'high',
            last_scored_at: now.toISOString(),
        }, { storagePath, now });
        const leaderboard = await (0, store_1.getLeaderboard)({ storagePath });
        strict_1.default.equal(leaderboard.entries.length, 1);
        strict_1.default.equal(leaderboard.entries[0].username, 'octocat');
        strict_1.default.equal(leaderboard.entries[0].slop_score, 72);
    });
    (0, node_test_1.it)('filters by confidence floor', async () => {
        const storagePath = await createStoragePath();
        const now = new Date('2026-02-23T00:00:00.000Z');
        await (0, store_1.upsertLeaderboardEntry)({
            username: 'low-signal',
            slop_score: 18,
            tier: 'The Tab-Key Athlete',
            confidence: 'low',
            last_scored_at: now.toISOString(),
        }, { storagePath, now });
        await (0, store_1.upsertLeaderboardEntry)({
            username: 'medium-signal',
            slop_score: 44,
            tier: 'The LLM Diplomat',
            confidence: 'medium',
            last_scored_at: now.toISOString(),
        }, { storagePath, now });
        const leaderboard = await (0, store_1.getLeaderboard)({ storagePath });
        strict_1.default.equal(leaderboard.entries.length, 1);
        strict_1.default.equal(leaderboard.entries[0].username, 'medium-signal');
    });
    (0, node_test_1.it)('skips rapid repeat updates', async () => {
        const storagePath = await createStoragePath();
        const now = new Date('2026-02-23T00:00:00.000Z');
        const later = new Date('2026-02-23T00:05:00.000Z');
        await (0, store_1.upsertLeaderboardEntry)({
            username: 'repeat',
            slop_score: 30,
            tier: 'The Tab-Key Athlete',
            confidence: 'medium',
            last_scored_at: now.toISOString(),
        }, { storagePath, now, minUpdateIntervalMinutes: 10 });
        const skipped = await (0, store_1.upsertLeaderboardEntry)({
            username: 'repeat',
            slop_score: 60,
            tier: 'The LLM Diplomat',
            confidence: 'medium',
            last_scored_at: later.toISOString(),
        }, { storagePath, now: later, minUpdateIntervalMinutes: 10 });
        strict_1.default.equal(skipped, null);
        const leaderboard = await (0, store_1.getLeaderboard)({
            storagePath,
            confidenceFloor: 'low',
        });
        strict_1.default.equal(leaderboard.entries[0].slop_score, 30);
    });
});
