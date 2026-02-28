"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCommitArtifactCache = exports.setCachedCommitArtifact = exports.getCachedCommitArtifact = void 0;
const MAX_CACHE_SIZE = 5000;
const commitArtifactCache = new Map();
const getKey = (repo, sha) => `${repo.toLowerCase()}:${sha}`;
const getCachedCommitArtifact = (repo, sha, now) => {
    const key = getKey(repo, sha);
    const entry = commitArtifactCache.get(key);
    if (!entry) {
        return null;
    }
    if (entry.expiresAt <= now.getTime()) {
        commitArtifactCache.delete(key);
        return null;
    }
    return entry.value;
};
exports.getCachedCommitArtifact = getCachedCommitArtifact;
const setCachedCommitArtifact = (repo, sha, value, now, ttlMs) => {
    const key = getKey(repo, sha);
    commitArtifactCache.set(key, {
        value,
        expiresAt: now.getTime() + ttlMs,
    });
    if (commitArtifactCache.size <= MAX_CACHE_SIZE) {
        return;
    }
    const nowMs = now.getTime();
    for (const [cacheKey, entry] of commitArtifactCache) {
        if (entry.expiresAt <= nowMs) {
            commitArtifactCache.delete(cacheKey);
        }
    }
    if (commitArtifactCache.size <= MAX_CACHE_SIZE) {
        return;
    }
    const sorted = [...commitArtifactCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const removeCount = sorted.length - MAX_CACHE_SIZE;
    for (let i = 0; i < removeCount; i += 1) {
        const entry = sorted[i];
        if (entry) {
            commitArtifactCache.delete(entry[0]);
        }
    }
};
exports.setCachedCommitArtifact = setCachedCommitArtifact;
const clearCommitArtifactCache = () => {
    commitArtifactCache.clear();
};
exports.clearCommitArtifactCache = clearCommitArtifactCache;
