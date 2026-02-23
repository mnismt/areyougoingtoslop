import type { SlopScoreResult } from "../scoring";

type CacheEntry = {
  value: SlopScoreResult;
  expiresAt: number;
};

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
};

export const clearScoreCache = () => {
  scoreCache.clear();
};
