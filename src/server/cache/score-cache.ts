import type { SlopScoreResult } from "../scoring";

type CacheEntry = {
  value: SlopScoreResult;
  expiresAt: number;
};

const MAX_CACHE_SIZE = 1000;

const scoreCache = new Map<string, CacheEntry>();

export const getCachedScore = (username: string, now: Date) => {
  const key = username.toLowerCase();
  const entry = scoreCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= now.getTime()) {
    scoreCache.delete(key);
    return null;
  }
  return entry.value;
};

export const setCachedScore = (
  username: string,
  value: SlopScoreResult,
  now: Date,
  ttlMs: number,
) => {
  const key = username.toLowerCase();
  scoreCache.set(key, { value, expiresAt: now.getTime() + ttlMs });

  if (scoreCache.size > MAX_CACHE_SIZE) {
    const nowMs = now.getTime();
    for (const [k, entry] of scoreCache) {
      if (entry.expiresAt <= nowMs) {
        scoreCache.delete(k);
      }
    }

    if (scoreCache.size > MAX_CACHE_SIZE) {
      const sorted = [...scoreCache.entries()].sort(
        (a, b) => a[1].expiresAt - b[1].expiresAt,
      );
      const toRemove = sorted.length - MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        scoreCache.delete(sorted[i][0]);
      }
    }
  }
};

export const clearScoreCache = () => {
  scoreCache.clear();
};
