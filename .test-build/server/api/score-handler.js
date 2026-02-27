"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScoreHandler = void 0;
const server_1 = require("next/server");
const node_perf_hooks_1 = require("node:perf_hooks");
const score_1 = require("./score");
const leaderboard_1 = require("../leaderboard");
const cache_1 = require("../cache");
const rate_limit_1 = require("../rate-limit");
const metrics_1 = require("../perf/metrics");
const github_1 = require("../github");
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 30;
const rateLimiter = new rate_limit_1.MemoryRateLimiter({
    windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
    maxRequests: DEFAULT_RATE_LIMIT_MAX,
});
const getClientKey = (request) => {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0]?.trim() ?? "unknown";
    }
    const realIp = request.headers.get("x-real-ip");
    return realIp ?? "unknown";
};
const createScoreHandler = (scorer = score_1.scoreUser, options = {}) => {
    const limiter = options.rateLimit
        ? new rate_limit_1.MemoryRateLimiter(options.rateLimit)
        : rateLimiter;
    return async (request, context) => {
        const { username } = await context.params;
        if (!(0, github_1.isValidGitHubUsername)(username)) {
            return server_1.NextResponse.json({ error: "invalid_username", message: "Invalid GitHub username." }, { status: 400 });
        }
        const now = options.now ?? new Date();
        if (options.enableRateLimit !== false) {
            const key = getClientKey(request);
            const limitResult = limiter.check(key, now.getTime());
            if (!limitResult.allowed) {
                return server_1.NextResponse.json({
                    error: "rate_limited",
                    message: "Too many requests. Slow down and try again.",
                    reset_at: new Date(limitResult.resetAt).toISOString(),
                }, { status: 429 });
            }
        }
        try {
            if (options.enableCache !== false) {
                const cached = (0, cache_1.getCachedScore)(username, now);
                if (cached) {
                    return server_1.NextResponse.json(cached, {
                        status: 200,
                        headers: {
                            "x-cache": "hit",
                        },
                    });
                }
            }
            const start = node_perf_hooks_1.performance.now();
            const result = await scorer(username);
            const durationMs = node_perf_hooks_1.performance.now() - start;
            (0, metrics_1.recordScoreTiming)(durationMs);
            const p95 = (0, metrics_1.getScoreP95)();
            if (options.recordLeaderboard !== false) {
                await (0, leaderboard_1.upsertLeaderboardEntry)({
                    username,
                    slop_score: result.slop_score,
                    tier: result.tier,
                    confidence: result.confidence,
                    last_scored_at: now.toISOString(),
                });
            }
            if (options.enableCache !== false) {
                const ttlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
                (0, cache_1.setCachedScore)(username, result, now, ttlMs);
            }
            console.info("score_request", {
                username,
                duration_ms: Math.round(durationMs),
                p95_ms: p95 ? Math.round(p95) : null,
            });
            return server_1.NextResponse.json(result, { status: 200 });
        }
        catch (error) {
            if (error instanceof github_1.GitHubNotFoundError) {
                return server_1.NextResponse.json({ error: "not_found", message: "GitHub user not found." }, { status: 404 });
            }
            if (error instanceof github_1.GitHubRateLimitError) {
                return server_1.NextResponse.json({
                    error: "rate_limited",
                    message: "GitHub API rate limit exceeded.",
                    reset_at: error.resetAt,
                }, { status: 429 });
            }
            if (error instanceof github_1.GitHubValidationError) {
                return server_1.NextResponse.json({ error: "invalid_username", message: error.message }, { status: 400 });
            }
            return server_1.NextResponse.json({
                error: "server_error",
                message: "Unable to compute score right now.",
            }, { status: 500 });
        }
    };
};
exports.createScoreHandler = createScoreHandler;
