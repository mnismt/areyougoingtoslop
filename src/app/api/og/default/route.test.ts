import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { OG_IMAGE_CACHE_CONTROL } from '../og-response'
import { GET } from './route'

describe('default og route', () => {
  it('returns png response with cache headers', async () => {
    const runtime = globalThis as typeof globalThis & {
      __aysDefaultOgRouteOverrides?: {
        loadOgFonts?: () => Promise<unknown[]>
      }
    }
    runtime.__aysDefaultOgRouteOverrides = {
      loadOgFonts: async () => [],
    }

    try {
      const response = await GET()

      assert.equal(response.status, 200)
      assert.ok(response.headers.get('content-type')?.startsWith('image/png'))
      assert.equal(
        response.headers.get('cache-control'),
        OG_IMAGE_CACHE_CONTROL,
      )
      assert.ok(response.body)
    } finally {
      runtime.__aysDefaultOgRouteOverrides = undefined
    }
  })
})
