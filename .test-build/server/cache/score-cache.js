"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearScoreCache = exports.setCachedScore = exports.getCachedScore = void 0;
const scoreCache = new Map();
const getCachedScore = (username, now) => {
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
exports.getCachedScore = getCachedScore;
const setCachedScore = (username, value, now, ttlMs) => {
    const key = username.toLowerCase();
    scoreCache.set(key, { value, expiresAt: now.getTime() + ttlMs });
};
exports.setCachedScore = setCachedScore;
const clearScoreCache = () => {
    scoreCache.clear();
};
exports.clearScoreCache = clearScoreCache;
