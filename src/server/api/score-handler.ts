import { NextRequest, NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { scoreUser } from "./score";
import { upsertLeaderboardEntry } from "../leaderboard";
import { getCachedScore, setCachedScore } from "../cache";
import { MemoryRateLimiter } from "../rate-limit";
import { getScoreP95, recordScoreTiming } from "../perf/metrics";
import {
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubValidationError,
  isValidGitHubUsername,
} from "../github";

export type ScoreHandler = (
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
) => Promise<NextResponse>;

export type ScoreHandlerOptions = {
  recordLeaderboard?: boolean;
  enableCache?: boolean;
  cacheTtlMs?: number;
  enableRateLimit?: boolean;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  now?: Date;
};

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 30;

const rateLimiter = new MemoryRateLimiter({
  windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
  maxRequests: DEFAULT_RATE_LIMIT_MAX,
});

const getClientKey = (request: NextRequest) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  return realIp ?? "unknown";
};

export const createScoreHandler =
  (
    scorer: typeof scoreUser = scoreUser,
    options: ScoreHandlerOptions = {},
  ): ScoreHandler =>
  {
    const limiter = options.rateLimit
      ? new MemoryRateLimiter(options.rateLimit)
      : rateLimiter;

    return async (request, context) => {
    const { username } = await context.params;
    if (!isValidGitHubUsername(username)) {
      return NextResponse.json(
        { error: "invalid_username", message: "Invalid GitHub username." },
        { status: 400 },
      );
    }

    const now = options.now ?? new Date();
    if (options.enableRateLimit !== false) {
      const key = getClientKey(request);
      const limitResult = limiter.check(key, now.getTime());
      if (!limitResult.allowed) {
        return NextResponse.json(
          {
            error: "rate_limited",
            message: "Too many requests. Slow down and try again.",
            reset_at: new Date(limitResult.resetAt).toISOString(),
          },
          { status: 429 },
        );
      }
    }

    try {
      if (options.enableCache !== false) {
        const cached = getCachedScore(username, now);
        if (cached) {
          return NextResponse.json(cached, {
            status: 200,
            headers: {
              "x-cache": "hit",
            },
          });
        }
      }

      const start = performance.now();
      const result = await scorer(username);
      const durationMs = performance.now() - start;
      recordScoreTiming(durationMs);
      const p95 = getScoreP95();

      if (options.recordLeaderboard !== false) {
        await upsertLeaderboardEntry({
          username,
          slop_score: result.slop_score,
          tier: result.tier,
          confidence: result.confidence,
          last_scored_at: now.toISOString(),
        });
      }
      if (options.enableCache !== false) {
        const ttlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
        setCachedScore(username, result, now, ttlMs);
      }

      console.info("score_request", {
        username,
        duration_ms: Math.round(durationMs),
        p95_ms: p95 ? Math.round(p95) : null,
      });

      return NextResponse.json(result, { status: 200 });
    } catch (error) {
      if (error instanceof GitHubNotFoundError) {
        return NextResponse.json(
          { error: "not_found", message: "GitHub user not found." },
          { status: 404 },
        );
      }
      if (error instanceof GitHubRateLimitError) {
        return NextResponse.json(
          {
            error: "rate_limited",
            message: "GitHub API rate limit exceeded.",
            reset_at: error.resetAt,
          },
          { status: 429 },
        );
      }
      if (error instanceof GitHubValidationError) {
        return NextResponse.json(
          { error: "invalid_username", message: error.message },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          error: "server_error",
          message: "Unable to compute score right now.",
        },
        { status: 500 },
      );
    }
    };
  };
