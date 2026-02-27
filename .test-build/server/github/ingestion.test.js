"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("./index");
const createMockFetch = (routes) => {
    return async (input) => {
        const url = typeof input === "string" ? input : input.toString();
        const route = routes[url];
        if (!route) {
            return new Response("Not Found", { status: 404 });
        }
        const status = route.status ?? 200;
        const headers = route.headers ?? {};
        const body = route.body ? JSON.stringify(route.body) : "";
        return new Response(body, {
            status,
            headers,
        });
    };
};
(0, node_test_1.describe)("fetchUserActivity", () => {
    (0, node_test_1.it)("rejects invalid usernames", async () => {
        await strict_1.default.rejects(() => (0, index_1.fetchUserActivity)("bad--name"), index_1.GitHubValidationError);
    });
    (0, node_test_1.it)("filters events outside the recency window", async () => {
        const now = new Date("2026-02-23T00:00:00.000Z");
        const mockFetch = createMockFetch({
            "https://api.github.com/users/octocat": {
                body: { login: "octocat", id: 1, type: "User" },
            },
            "https://api.github.com/users/octocat/events/public?per_page=100&page=1": {
                body: [
                    {
                        id: "1",
                        type: "PushEvent",
                        repo: { name: "octo/repo" },
                        created_at: "2026-02-20T00:00:00.000Z",
                        payload: {
                            commits: [{ sha: "abc", message: "feat: ship it" }],
                        },
                    },
                    {
                        id: "2",
                        type: "PushEvent",
                        repo: { name: "octo/repo" },
                        created_at: "2025-06-01T00:00:00.000Z",
                        payload: {
                            commits: [{ sha: "def", message: "old commit" }],
                        },
                    },
                ],
            },
            "https://api.github.com/repos/octo/repo/commits/abc": {
                body: {
                    sha: "abc",
                    commit: {
                        message: "feat: ship it",
                        author: { date: "2026-02-20T00:00:00.000Z" },
                    },
                    stats: { additions: 10, deletions: 2, total: 12 },
                    files: [{ filename: "src/index.ts" }],
                },
            },
        });
        const events = await (0, index_1.fetchUserActivity)("octocat", {
            fetcher: mockFetch,
            now,
            maxCommitStats: 1,
        });
        strict_1.default.equal(events.length, 1);
        strict_1.default.equal(events[0]?.sha, "abc");
        strict_1.default.equal(events[0]?.additions, 10);
    });
    (0, node_test_1.it)("throws a rate limit error when remaining is zero", async () => {
        const mockFetch = createMockFetch({
            "https://api.github.com/users/octocat": {
                body: { login: "octocat", id: 1, type: "User" },
            },
            "https://api.github.com/users/octocat/events/public?per_page=100&page=1": {
                status: 403,
                body: { message: "API rate limit exceeded" },
                headers: {
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": "1730000000",
                },
            },
        });
        await strict_1.default.rejects(() => (0, index_1.fetchUserActivity)("octocat", { fetcher: mockFetch }), index_1.GitHubRateLimitError);
    });
});
