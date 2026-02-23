import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getLeaderboard, upsertLeaderboardEntry } from "./store";

const createStoragePath = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "leaderboard-"));
  return path.join(dir, "leaderboard.json");
};

describe("leaderboard store", () => {
  it("stores and retrieves entries", async () => {
    const storagePath = await createStoragePath();
    const now = new Date("2026-02-23T00:00:00.000Z");

    await upsertLeaderboardEntry(
      {
        username: "octocat",
        slop_score: 72,
        tier: "The Agent Supervisor",
        confidence: "high",
        last_scored_at: now.toISOString(),
      },
      { storagePath, now },
    );

    const leaderboard = await getLeaderboard({ storagePath });
    assert.equal(leaderboard.entries.length, 1);
    assert.equal(leaderboard.entries[0].username, "octocat");
    assert.equal(leaderboard.entries[0].slop_score, 72);
  });

  it("filters by confidence floor", async () => {
    const storagePath = await createStoragePath();
    const now = new Date("2026-02-23T00:00:00.000Z");

    await upsertLeaderboardEntry(
      {
        username: "low-signal",
        slop_score: 18,
        tier: "The Tab-Key Athlete",
        confidence: "low",
        last_scored_at: now.toISOString(),
      },
      { storagePath, now },
    );

    await upsertLeaderboardEntry(
      {
        username: "medium-signal",
        slop_score: 44,
        tier: "The LLM Diplomat",
        confidence: "medium",
        last_scored_at: now.toISOString(),
      },
      { storagePath, now },
    );

    const leaderboard = await getLeaderboard({ storagePath });
    assert.equal(leaderboard.entries.length, 1);
    assert.equal(leaderboard.entries[0].username, "medium-signal");
  });

  it("skips rapid repeat updates", async () => {
    const storagePath = await createStoragePath();
    const now = new Date("2026-02-23T00:00:00.000Z");
    const later = new Date("2026-02-23T00:05:00.000Z");

    await upsertLeaderboardEntry(
      {
        username: "repeat",
        slop_score: 30,
        tier: "The Tab-Key Athlete",
        confidence: "medium",
        last_scored_at: now.toISOString(),
      },
      { storagePath, now, minUpdateIntervalMinutes: 10 },
    );

    const skipped = await upsertLeaderboardEntry(
      {
        username: "repeat",
        slop_score: 60,
        tier: "The LLM Diplomat",
        confidence: "medium",
        last_scored_at: later.toISOString(),
      },
      { storagePath, now: later, minUpdateIntervalMinutes: 10 },
    );

    assert.equal(skipped, null);
    const leaderboard = await getLeaderboard({
      storagePath,
      confidenceFloor: "low",
    });
    assert.equal(leaderboard.entries[0].slop_score, 30);
  });
});
