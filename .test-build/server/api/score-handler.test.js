"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const server_1 = require("next/server");
const score_handler_1 = require("./score-handler");
const github_1 = require("../github");
(0, node_test_1.describe)("score handler", () => {
    (0, node_test_1.it)("returns score payload on success", async () => {
        const handler = (0, score_handler_1.createScoreHandler)(async () => ({
            slop_score: 42,
            tier: "The LLM Diplomat",
            confidence: "medium",
            top_signals: ["Commit messages mention AI tools"],
            scoring_window: "last 180 days",
        }), {
            recordLeaderboard: false,
            enableCache: false,
            enableRateLimit: false,
        });
        const response = await handler(new server_1.NextRequest("http://localhost"), {
            params: Promise.resolve({ username: "octocat" }),
        });
        strict_1.default.equal(response.status, 200);
        const body = await response.json();
        strict_1.default.equal(body.slop_score, 42);
        strict_1.default.equal(body.tier, "The LLM Diplomat");
    });
    (0, node_test_1.it)("rejects invalid usernames", async () => {
        const handler = (0, score_handler_1.createScoreHandler)(async () => ({
            slop_score: 0,
            tier: "The Artisanal Masochist",
            confidence: "low",
            top_signals: ["Low signal density in the recent activity window"],
            scoring_window: "last 180 days",
        }), {
            recordLeaderboard: false,
            enableCache: false,
            enableRateLimit: false,
        });
        const response = await handler(new server_1.NextRequest("http://localhost"), {
            params: Promise.resolve({ username: "bad--name" }),
        });
        strict_1.default.equal(response.status, 400);
    });
    (0, node_test_1.it)("maps rate limit errors to 429", async () => {
        const handler = (0, score_handler_1.createScoreHandler)(async () => {
            throw new github_1.GitHubRateLimitError("rate limited", "2026-02-23T00:00:00.000Z");
        }, {
            recordLeaderboard: false,
            enableCache: false,
            enableRateLimit: false,
        });
        const response = await handler(new server_1.NextRequest("http://localhost"), {
            params: Promise.resolve({ username: "octocat" }),
        });
        strict_1.default.equal(response.status, 429);
        const body = await response.json();
        strict_1.default.equal(body.error, "rate_limited");
    });
    (0, node_test_1.it)("rate limits repeated requests", async () => {
        const handler = (0, score_handler_1.createScoreHandler)(async () => ({
            slop_score: 10,
            tier: "The Artisanal Masochist",
            confidence: "low",
            top_signals: ["Low signal density in the recent activity window"],
            scoring_window: "last 180 days",
        }), {
            recordLeaderboard: false,
            enableCache: false,
            enableRateLimit: true,
            rateLimit: { windowMs: 60000, maxRequests: 1 },
            now: new Date("2026-02-23T00:00:00.000Z"),
        });
        const request = new server_1.NextRequest("http://localhost", {
            headers: { "x-forwarded-for": "203.0.113.1" },
        });
        const first = await handler(request, {
            params: Promise.resolve({ username: "octocat" }),
        });
        const second = await handler(request, {
            params: Promise.resolve({ username: "octocat" }),
        });
        strict_1.default.equal(first.status, 200);
        strict_1.default.equal(second.status, 429);
    });
    (0, node_test_1.it)("serves cached responses within ttl", async () => {
        let calls = 0;
        const handler = (0, score_handler_1.createScoreHandler)(async () => {
            calls += 1;
            return {
                slop_score: 55,
                tier: "The LLM Diplomat",
                confidence: "medium",
                top_signals: ["Commit messages mention AI tools"],
                scoring_window: "last 180 days",
            };
        }, {
            recordLeaderboard: false,
            enableCache: true,
            cacheTtlMs: 60000,
            enableRateLimit: false,
            now: new Date("2026-02-23T00:00:00.000Z"),
        });
        const request = new server_1.NextRequest("http://localhost");
        await handler(request, { params: Promise.resolve({ username: "octocat" }) });
        await handler(request, { params: Promise.resolve({ username: "octocat" }) });
        strict_1.default.equal(calls, 1);
    });
});
