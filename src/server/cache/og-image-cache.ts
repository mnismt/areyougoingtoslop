import { getEnv } from '../env'

const getKey = (username: string) => `og:v1:${username.toLowerCase()}`

// KV owns expiry. Best-effort: failures degrade to a cache miss.
export const getCachedOgImage = async (
  username: string,
): Promise<ArrayBuffer | null> => {
  try {
    return await getEnv().CACHE.get(getKey(username), 'arrayBuffer')
  } catch (error) {
    console.warn('og_cache_read_failed', { username, error })
    return null
  }
}

export const setCachedOgImage = async (
  username: string,
  png: ArrayBuffer,
  ttlMs: number,
): Promise<void> => {
  try {
    await getEnv().CACHE.put(getKey(username), png, {
      expirationTtl: Math.max(60, Math.ceil(ttlMs / 1000)),
    })
  } catch (error) {
    console.warn('og_cache_write_failed', { username, error })
  }
}
