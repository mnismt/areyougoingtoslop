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
      { recordLeaderboard: false },
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
      { recordLeaderboard: false },
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
      { recordLeaderboard: false },
    );

    const response = await handler(new NextRequest("http://localhost"), {
      params: Promise.resolve({ username: "octocat" }),
    });

    assert.equal(response.status, 429);
    const body = await response.json();
    assert.equal(body.error, "rate_limited");
  });
});
