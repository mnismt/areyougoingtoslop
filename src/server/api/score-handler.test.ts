import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createScoreHandler } from "./score-handler";
import { GitHubRateLimitError } from "../github";

describe("score handler", () => {
  it("returns score payload on success", async () => {
    const handler = createScoreHandler(
      async () => ({
        slop_score: 42,
        tier: "The LLM Diplomat",
        confidence: "medium",
        top_signals: ["Commit messages mention AI tools"],
        scoring_window: "last 180 days",
      }),
      {
        recordLeaderboard: false,
        enableCache: false,
        enableRateLimit: false,
      },
    );

    const response = await handler(new NextRequest("http://localhost"), {
      params: Promise.resolve({ username: "octocat" }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.slop_score, 42);
    assert.equal(body.tier, "The LLM Diplomat");
  });

  it("rejects invalid usernames", async () => {
    const handler = createScoreHandler(
      async () => ({
        slop_score: 0,
        tier: "The Artisanal Masochist",
        confidence: "low",
        top_signals: ["Low signal density in the recent activity window"],
        scoring_window: "last 180 days",
      }),
      {
        recordLeaderboard: false,
        enableCache: false,
        enableRateLimit: false,
      },
    );

    const response = await handler(new NextRequest("http://localhost"), {
      params: Promise.resolve({ username: "bad--name" }),
    });

    assert.equal(response.status, 400);
  });

  it("maps rate limit errors to 429", async () => {
    const handler = createScoreHandler(
      async () => {
        throw new GitHubRateLimitError(
          "rate limited",
          "2026-02-23T00:00:00.000Z",
        );
      },
      {
        recordLeaderboard: false,
        enableCache: false,
        enableRateLimit: false,
      },
    );

    const response = await handler(new NextRequest("http://localhost"), {
      params: Promise.resolve({ username: "octocat" }),
    });

    assert.equal(response.status, 429);
    const body = await response.json();
    assert.equal(body.error, "rate_limited");
  });

  it("rate limits repeated requests", async () => {
    const handler = createScoreHandler(
      async () => ({
        slop_score: 10,
        tier: "The Artisanal Masochist",
        confidence: "low",
        top_signals: ["Low signal density in the recent activity window"],
        scoring_window: "last 180 days",
      }),
      {
        recordLeaderboard: false,
        enableCache: false,
        enableRateLimit: true,
        rateLimit: { windowMs: 60_000, maxRequests: 1 },
        now: new Date("2026-02-23T00:00:00.000Z"),
      },
    );

    const request = new NextRequest("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.1" },
    });

    const first = await handler(request, {
      params: Promise.resolve({ username: "octocat" }),
    });
    const second = await handler(request, {
      params: Promise.resolve({ username: "octocat" }),
    });

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
  });

  it("serves cached responses within ttl", async () => {
    let calls = 0;
    const handler = createScoreHandler(
      async () => {
        calls += 1;
        return {
          slop_score: 55,
          tier: "The LLM Diplomat",
          confidence: "medium",
          top_signals: ["Commit messages mention AI tools"],
          scoring_window: "last 180 days",
        };
      },
      {
        recordLeaderboard: false,
        enableCache: true,
        cacheTtlMs: 60_000,
        enableRateLimit: false,
        now: new Date("2026-02-23T00:00:00.000Z"),
      },
    );

    const request = new NextRequest("http://localhost");
    await handler(request, { params: Promise.resolve({ username: "octocat" }) });
    await handler(request, { params: Promise.resolve({ username: "octocat" }) });

    assert.equal(calls, 1);
  });
});
