import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { setEnv } from '../env'
import { createFakeEnv } from '../testing/fake-env'
import { getCachedOgImage, setCachedOgImage } from './og-image-cache'

const makePng = (byte: number) => new Uint8Array([byte]).buffer

describe('og-image-cache (KV)', () => {
  beforeEach(() => setEnv(createFakeEnv().env))
  afterEach(() => setEnv(null))

  it('returns null for unknown username', async () => {
    assert.equal(await getCachedOgImage('nobody'), null)
  })

  it('round trips a png', async () => {
    const png = makePng(1)
    await setCachedOgImage('octocat', png, 60_000)
    const result = await getCachedOgImage('octocat')
    assert.ok(result instanceof ArrayBuffer)
    assert.deepEqual(new Uint8Array(result), new Uint8Array(png))
  })

  it('is case-insensitive for username key', async () => {
    await setCachedOgImage('OctoCat', makePng(2), 60_000)
    assert.ok((await getCachedOgImage('octocat')) instanceof ArrayBuffer)
    assert.ok((await getCachedOgImage('OCTOCAT')) instanceof ArrayBuffer)
  })

  it('accepts sub-minute TTLs by clamping to the KV minimum', async () => {
    await setCachedOgImage('short', makePng(3), 1_000)
    assert.ok((await getCachedOgImage('short')) instanceof ArrayBuffer)
  })
})
