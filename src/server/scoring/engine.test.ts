import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSlopScore } from "./engine";
import { mapScoreToTier } from "./tier";
import type { ContributionEvent } from "../types";

describe("computeSlopScore", () => {
  it("applies recency weighting and produces deterministic score", () => {
    const now = new Date("2026-02-23T00:00:00.000Z");
    const events: ContributionEvent[] = [
      {
        id: "a",
        type: "commit",
        repo: "octo/repo",
        sha: "a",
        message: "feat: add copilot support",
        occurredAt: "2026-02-20T00:00:00.000Z",
      },
      {
        id: "b",
        type: "commit",
        repo: "octo/repo",
        sha: "b",
        message: "refactor: cleanup",
        occurredAt: "2026-02-20T00:00:00.000Z",
      },
      {
        id: "c",
        type: "commit",
        repo: "octo/repo",
        sha: "c",
        message: "docs: update by chatgpt",
        occurredAt: "2025-10-20T00:00:00.000Z",
      },
    ];

    const result = computeSlopScore(events, undefined, now);
    assert.equal(result.slop_score, 20);
    assert.equal(result.confidence, "low");
  });
});

describe("mapScoreToTier", () => {
  it("maps score to tier boundaries", () => {
    assert.equal(mapScoreToTier(5), "The Artisanal Masochist");
    assert.equal(mapScoreToTier(25), "The Tab-Key Athlete");
    assert.equal(mapScoreToTier(45), "The LLM Diplomat");
    assert.equal(mapScoreToTier(70), "The Agent Supervisor");
    assert.equal(mapScoreToTier(99), "The Unsupervised Slop Machine");
  });
});
