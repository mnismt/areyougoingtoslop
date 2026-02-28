import type { GitHubCommit } from '../github'

type CommitCacheEntry = {
  value: GitHubCommit
  expiresAt: number
}

const MAX_CACHE_SIZE = 5000

const commitArtifactCache = new Map<string, CommitCacheEntry>()

const getKey = (repo: string, sha: string) => `${repo.toLowerCase()}:${sha}`

export const getCachedCommitArtifact = (
  repo: string,
  sha: string,
  now: Date,
) => {
  const key = getKey(repo, sha)
  const entry = commitArtifactCache.get(key)
  if (!entry) {
    return null
  }
  if (entry.expiresAt <= now.getTime()) {
    commitArtifactCache.delete(key)
    return null
  }
  return entry.value
}

export const setCachedCommitArtifact = (
  repo: string,
  sha: string,
  value: GitHubCommit,
  now: Date,
  ttlMs: number,
) => {
  const key = getKey(repo, sha)
  commitArtifactCache.set(key, {
    value,
    expiresAt: now.getTime() + ttlMs,
  })

  if (commitArtifactCache.size <= MAX_CACHE_SIZE) {
    return
  }

  const nowMs = now.getTime()
  for (const [cacheKey, entry] of commitArtifactCache) {
    if (entry.expiresAt <= nowMs) {
      commitArtifactCache.delete(cacheKey)
    }
  }

  if (commitArtifactCache.size <= MAX_CACHE_SIZE) {
    return
  }

  const sorted = [...commitArtifactCache.entries()].sort(
    (a, b) => a[1].expiresAt - b[1].expiresAt,
  )
  const removeCount = sorted.length - MAX_CACHE_SIZE
  for (let i = 0; i < removeCount; i += 1) {
    const entry = sorted[i]
    if (entry) {
      commitArtifactCache.delete(entry[0])
    }
  }
}

export const clearCommitArtifactCache = () => {
  commitArtifactCache.clear()
}
