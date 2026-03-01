import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { OG_IMAGE_CACHE_CONTROL } from '../og-response'
import { GET } from './route'

describe('dynamic og route', () => {
  it('returns png for result variant', async () => {
    const runtime = globalThis as typeof globalThis & {
      __aysOgRouteOverrides?: {
        resolveOgData?: (username: string) => Promise<unknown>
        loadOgFonts?: () => Promise<unknown[]>
      }
    }

    runtime.__aysOgRouteOverrides = {
      resolveOgData: async () => ({
        source: 'cache',
        viewModel: {
          variant: 'result',
          username: 'gaearon',
          avatarDataUri: null,
          slopScore: 18,
          tier: 'the tab-key athlete',
          tierTagline: 'autocomplete exists. you choose not to know.',
          confidence: 'high',
          scoringWindow: 'last 180 days',
          stats: {
            commitsInspected: 120,
            reposRaided: 7,
            windowDays: 180,
            intelSources: 2,
          },
          topSignals: ['suspicious velocity spikes'],
        },
      }),
      loadOgFonts: async () => [],
    }

    try {
      const response = await GET(new Request('http://localhost'), {
        params: Promise.resolve({ username: 'gaearon' }),
      })

      assert.equal(response.status, 200)
      assert.ok(response.headers.get('content-type')?.startsWith('image/png'))
      assert.equal(
        response.headers.get('cache-control'),
        OG_IMAGE_CACHE_CONTROL,
      )
      assert.ok(response.body)
    } finally {
      runtime.__aysOgRouteOverrides = undefined
    }
  })

  it('returns png for fallback variant', async () => {
    const runtime = globalThis as typeof globalThis & {
      __aysOgRouteOverrides?: {
        resolveOgData?: (username: string) => Promise<unknown>
        loadOgFonts?: () => Promise<unknown[]>
      }
    }

    runtime.__aysOgRouteOverrides = {
      resolveOgData: async () => ({
        source: 'fallback',
        viewModel: {
          variant: 'not_found',
          username: 'missing-user',
          avatarDataUri: null,
          title: 'ghost account',
          subtitle: "that username doesn't exist.",
        },
      }),
      loadOgFonts: async () => [],
    }

    try {
      const response = await GET(new Request('http://localhost'), {
        params: Promise.resolve({ username: 'missing-user' }),
      })

      assert.equal(response.status, 200)
      assert.ok(response.headers.get('content-type')?.startsWith('image/png'))
      assert.equal(
        response.headers.get('cache-control'),
        OG_IMAGE_CACHE_CONTROL,
      )
      assert.ok(response.body)
    } finally {
      runtime.__aysOgRouteOverrides = undefined
    }
  })
})
