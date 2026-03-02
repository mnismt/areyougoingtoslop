type CacheEntry = {
  png: ArrayBuffer
  expiresAt: number
}

const MAX_CACHE_SIZE = 500

const ogImageCache = new Map<string, CacheEntry>()

export const getCachedOgImage = (username: string): ArrayBuffer | null => {
  const key = username.toLowerCase()
  const entry = ogImageCache.get(key)
  if (!entry) {
    return null
  }
  if (entry.expiresAt <= Date.now()) {
    ogImageCache.delete(key)
    return null
  }
  return entry.png
}

export const setCachedOgImage = (
  username: string,
  png: ArrayBuffer,
  ttlMs: number,
) => {
  const key = username.toLowerCase()
  ogImageCache.set(key, { png, expiresAt: Date.now() + ttlMs })

  if (ogImageCache.size > MAX_CACHE_SIZE) {
    const nowMs = Date.now()
    for (const [k, entry] of ogImageCache) {
      if (entry.expiresAt <= nowMs) {
        ogImageCache.delete(k)
      }
    }

    if (ogImageCache.size > MAX_CACHE_SIZE) {
      const sorted = [...ogImageCache.entries()].sort(
        (a, b) => a[1].expiresAt - b[1].expiresAt,
      )
      const toRemove = sorted.length - MAX_CACHE_SIZE
      for (let i = 0; i < toRemove; i++) {
        ogImageCache.delete(sorted[i][0])
      }
    }
  }
}

export const clearOgImageCache = () => {
  ogImageCache.clear()
}
