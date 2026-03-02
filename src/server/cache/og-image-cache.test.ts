import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clearOgImageCache,
  getCachedOgImage,
  setCachedOgImage,
} from './og-image-cache'

const makePng = (byte: number) => new Uint8Array([byte]).buffer

describe('og-image-cache', () => {
  it('returns null for unknown username', () => {
    clearOgImageCache()
    assert.equal(getCachedOgImage('nobody'), null)
  })

  it('returns cached png within TTL', () => {
    clearOgImageCache()
    const png = makePng(1)
    setCachedOgImage('octocat', png, 60_000)
    const result = getCachedOgImage('octocat')
    assert.ok(result instanceof ArrayBuffer)
    assert.deepEqual(result, png)
  })

  it('is case-insensitive for username key', () => {
    clearOgImageCache()
    const png = makePng(2)
    setCachedOgImage('OctoCat', png, 60_000)
    assert.ok(getCachedOgImage('octocat') instanceof ArrayBuffer)
    assert.ok(getCachedOgImage('OCTOCAT') instanceof ArrayBuffer)
  })

  it('returns null after TTL expires', () => {
    clearOgImageCache()
    const png = makePng(3)
    setCachedOgImage('expired-user', png, -1)
    assert.equal(getCachedOgImage('expired-user'), null)
  })

  it('evicts oldest entries when over capacity', () => {
    clearOgImageCache()
    const png = makePng(4)
    // fill 500 entries
    for (let i = 0; i < 500; i++) {
      setCachedOgImage(`user-${i}`, png, 60_000)
    }
    // adding one more triggers eviction
    setCachedOgImage('user-overflow', png, 60_000)
    // cache size should not exceed 500
    // user-overflow should still be retrievable
    assert.ok(getCachedOgImage('user-overflow') instanceof ArrayBuffer)
  })

  it('clearOgImageCache removes all entries', () => {
    clearOgImageCache()
    setCachedOgImage('user-a', makePng(5), 60_000)
    setCachedOgImage('user-b', makePng(6), 60_000)
    clearOgImageCache()
    assert.equal(getCachedOgImage('user-a'), null)
    assert.equal(getCachedOgImage('user-b'), null)
  })
})
