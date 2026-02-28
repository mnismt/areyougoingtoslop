"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const cache_1 = require("../cache");
const index_1 = require("./index");
const createMockFetch = (routes) => {
    return async (input) => {
        const url = new URL(typeof input === 'string' ? input : input.toString());
        const route = routes.find((candidate) => candidate.match(url));
        if (!route) {
            return new Response('Not Found', { status: 404 });
        }
        const body = route.body ? JSON.stringify(route.body) : '';
        return new Response(body, {
            status: route.status ?? 200,
            headers: route.headers,
        });
    };
};
(0, node_test_1.describe)('fetchUserActivity', () => {
    (0, node_test_1.it)('rejects invalid usernames', async () => {
        await strict_1.default.rejects(() => (0, index_1.fetchUserActivity)('bad--name'), index_1.GitHubValidationError);
    });
    (0, node_test_1.it)('dedupes events and repo commits with metadata coverage', async () => {
        (0, cache_1.clearCommitArtifactCache)();
        const now = new Date('2026-02-23T00:00:00.000Z');
        let commitDetailCalls = 0;
        const mockFetch = createMockFetch([
            {
                match: (url) => url.pathname === '/users/octocat/events/public' &&
                    url.searchParams.get('page') === '1',
                body: [
                    {
                        id: '1',
                        type: 'PushEvent',
                        repo: { name: 'octo/repo' },
                        created_at: '2026-02-20T00:00:00.000Z',
                        payload: {
                            commits: [{ sha: 'abc', message: 'feat: ship it' }],
                        },
                    },
                ],
            },
            {
                match: (url) => url.pathname === '/users/octocat/events/public' &&
                    url.searchParams.get('page') === '2',
                body: [],
            },
            {
                match: (url) => url.pathname === '/users/octocat/repos' &&
                    url.searchParams.get('page') === '1',
                body: [
                    {
                        full_name: 'octo/repo',
                        fork: false,
                        pushed_at: '2026-02-21T00:00:00.000Z',
                    },
                ],
            },
            {
                match: (url) => url.pathname === '/users/octocat/repos' &&
                    url.searchParams.get('page') === '2',
                body: [],
            },
            {
                match: (url) => url.pathname === '/repos/octo/repo/commits' &&
                    url.searchParams.get('page') === '1',
                body: [
                    {
                        sha: 'abc',
                        commit: {
                            message: 'feat: ship it',
                            author: { date: '2026-02-20T00:00:00.000Z' },
                        },
                    },
                    {
                        sha: 'xyz',
                        commit: {
                            message: 'docs: update by chatgpt',
                            author: { date: '2026-02-21T00:00:00.000Z' },
                        },
                    },
                ],
            },
            {
                match: (url) => url.pathname === '/repos/octo/repo/commits/abc',
                body: {
                    sha: 'abc',
                    commit: {
                        message: 'feat: ship it',
                        author: { date: '2026-02-20T00:00:00.000Z' },
                    },
                    stats: { additions: 10, deletions: 2, total: 12 },
                    files: [{ filename: 'src/index.ts' }],
                },
            },
            {
                match: (url) => url.pathname === '/repos/octo/repo/commits/xyz',
                body: {
                    sha: 'xyz',
                    commit: {
                        message: 'docs: update by chatgpt',
                        author: { date: '2026-02-21T00:00:00.000Z' },
                    },
                    stats: { additions: 40, deletions: 3, total: 43 },
                    files: [{ filename: 'README.md' }],
                },
            },
        ]);
        const countingFetch = async (input, _init) => {
            const url = new URL(typeof input === 'string' ? input : input.toString());
            if (url.pathname.startsWith('/repos/octo/repo/commits/')) {
                commitDetailCalls += 1;
            }
            return mockFetch(input);
        };
        const first = await (0, index_1.fetchUserActivityWithMetadata)('octocat', {
            fetcher: countingFetch,
            now,
            maxPages: 2,
            maxRepoCommitPages: 1,
            maxCommitStats: 10,
            maxRepos: 3,
        });
        strict_1.default.equal(first.events.length, 2);
        strict_1.default.equal(first.coverage.commitsDiscovered, 2);
        strict_1.default.equal(first.coverage.commitsEnriched, 2);
        strict_1.default.equal(first.coverage.reposScanned, 1);
        strict_1.default.equal(first.coverage.reposTotal, 1);
        strict_1.default.deepEqual(first.coverage.sourcesUsed, ['events', 'repo_commits']);
        strict_1.default.equal(first.events[0]?.sha, 'xyz');
        strict_1.default.equal(first.events[0]?.additions, 40);
        strict_1.default.equal(commitDetailCalls, 2);
        const second = await (0, index_1.fetchUserActivityWithMetadata)('octocat', {
            fetcher: countingFetch,
            now,
            maxPages: 2,
            maxRepoCommitPages: 1,
            maxCommitStats: 10,
            maxRepos: 3,
        });
        strict_1.default.equal(second.events.length, 2);
        strict_1.default.equal(commitDetailCalls, 2);
        (0, cache_1.clearCommitArtifactCache)();
    });
    (0, node_test_1.it)('marks events pagination as limited when github returns 422', async () => {
        const now = new Date('2026-02-23T00:00:00.000Z');
        const mockFetch = createMockFetch([
            {
                match: (url) => url.pathname === '/users/octocat/events/public',
                status: 422,
                body: { message: 'pagination limited' },
            },
            {
                match: (url) => url.pathname === '/users/octocat/repos',
                body: [],
            },
        ]);
        const result = await (0, index_1.fetchUserActivityWithMetadata)('octocat', {
            fetcher: mockFetch,
            now,
        });
        strict_1.default.equal(result.events.length, 0);
        strict_1.default.equal(result.limits.eventsPaginationLimited, true);
        strict_1.default.equal(result.coverage.isPartial, true);
    });
    (0, node_test_1.it)('throws a rate limit error when remaining is zero', async () => {
        const mockFetch = createMockFetch([
            {
                match: (url) => url.pathname === '/users/octocat/events/public',
                status: 403,
                body: { message: 'API rate limit exceeded' },
                headers: {
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': '1730000000',
                },
            },
        ]);
        await strict_1.default.rejects(() => (0, index_1.fetchUserActivity)('octocat', { fetcher: mockFetch }), index_1.GitHubRateLimitError);
    });
});
