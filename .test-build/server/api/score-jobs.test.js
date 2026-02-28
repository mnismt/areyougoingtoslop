"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const cache_1 = require("../cache");
const score_jobs_1 = require("./score-jobs");
(0, node_test_1.describe)('score jobs', () => {
    (0, node_test_1.it)('rejects invalid usernames', () => {
        (0, score_jobs_1.clearScoreJobs)();
        const result = (0, score_jobs_1.createOrAttachScoreJob)('bad--name');
        strict_1.default.equal(result.ok, false);
        if (result.ok) {
            throw new Error('Expected invalid username job creation to fail');
        }
        strict_1.default.equal(result.error.code, 'invalid_username');
    });
    (0, node_test_1.it)('returns null for unknown job ids', () => {
        (0, score_jobs_1.clearScoreJobs)();
        strict_1.default.equal((0, score_jobs_1.getScoreJob)('missing-job-id'), null);
    });
    (0, node_test_1.it)('creates immediate completed snapshot from cached score', () => {
        (0, score_jobs_1.clearScoreJobs)();
        (0, cache_1.clearScoreCache)();
        const now = new Date();
        (0, cache_1.setCachedScore)('octocat', {
            slop_score: 33,
            tier: 'The Tab-Key Athlete',
            confidence: 'medium',
            top_signals: ['Commit messages mention AI tools'],
            scoring_window: 'last 180 days',
            analyzed_commits: [
                {
                    sha: 'abc1234',
                    repo: 'octo/repo',
                    message: 'feat: ship it',
                    occurred_at: '2026-02-20T00:00:00.000Z',
                    additions: 20,
                    deletions: 3,
                    flags: ['ai_keyword'],
                },
            ],
        }, now, 60000);
        const result = (0, score_jobs_1.createOrAttachScoreJob)('octocat');
        strict_1.default.equal(result.ok, true);
        if (!result.ok) {
            throw new Error('Expected cached score job creation to succeed');
        }
        strict_1.default.equal(result.snapshot.status, 'completed');
        strict_1.default.equal(result.snapshot.progress_percent, 100);
        strict_1.default.equal(result.snapshot.result?.slop_score, 33);
        strict_1.default.equal(result.snapshot.coverage.commits_discovered, 1);
        strict_1.default.equal(result.snapshot.coverage.commits_enriched, 1);
        (0, cache_1.clearScoreCache)();
    });
});
