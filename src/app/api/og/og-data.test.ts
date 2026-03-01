import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GitHubNotFoundError,
  GitHubOrganizationError,
  GitHubRateLimitError,
} from '../../../server/github'
import type { SlopScoreResult } from '../../../server/scoring'
import { resolveOgData } from './og-data'

const makeScore = (): SlopScoreResult => ({
  slop_score: 18,
  tier: 'the tab-key athlete',
  tier_tagline: 'autocomplete exists. you choose not to know.',
  confidence: 'high',
  top_signals: [
    'commits with AI-attribution hints',
    'suspicious velocity spikes',
  ],
  scoring_window: 'last 180 days',
  analyzed_commits: [
    {
      sha: 'abc123',
      repo: 'foo/bar',
      message: 'test commit',
      occurred_at: '2026-02-20T00:00:00.000Z',
      additions: 12,
      deletions: 3,
      flags: [],
    },
  ],
})

describe('resolveOgData', () => {
  it('uses cache hit and does not call live scoring', async () => {
    let liveCalled = false
    const cached = makeScore()

    const result = await resolveOgData('gaearon', {
      now: () => new Date('2026-03-01T00:00:00.000Z'),
      getCachedScore: () => cached,
      setCachedScore: () => {
        assert.fail('setCachedScore should not run on cache hit')
      },
      scoreUserWithMetadata: async () => {
        liveCalled = true
        throw new Error('should not be called')
      },
      fetchAvatarDataUri: async () => 'data:image/png;base64,abc',
    })

    assert.equal(result.source, 'cache')
    assert.equal(result.viewModel.variant, 'result')
    assert.equal(liveCalled, false)
    if (result.viewModel.variant !== 'result') {
      assert.fail('expected result variant')
    }
    assert.equal(result.viewModel.avatarDataUri, 'data:image/png;base64,abc')
    assert.equal(result.viewModel.slopScore, cached.slop_score)
  })

  it('falls back to live scoring on cache miss and writes cache', async () => {
    let liveCalled = 0
    let setCalled = 0
    const liveScore = makeScore()

    const result = await resolveOgData('gaearon', {
      now: () => new Date('2026-03-01T00:00:00.000Z'),
      getCachedScore: () => null,
      setCachedScore: (_username, _value, _now, ttlMs) => {
        setCalled += 1
        assert.ok(ttlMs > 0)
      },
      scoreUserWithMetadata: async () => {
        liveCalled += 1
        return {
          result: liveScore,
          coverage: {
            commits_discovered: 10,
            commits_enriched: 8,
            repos_scanned: 4,
            repos_total: 6,
            window_days: 180,
            is_partial: false,
            sources_used: ['events', 'repos'],
          },
          limits: {
            rate_limited: false,
            events_pagination_limited: false,
          },
        }
      },
      fetchAvatarDataUri: async () => null,
    })

    assert.equal(result.source, 'live')
    assert.equal(result.viewModel.variant, 'result')
    assert.equal(liveCalled, 1)
    assert.equal(setCalled, 1)
  })

  it('maps invalid username to fallback variant', async () => {
    let avatarCalled = false
    const result = await resolveOgData('not valid', {
      fetchAvatarDataUri: async () => {
        avatarCalled = true
        return null
      },
    })

    assert.equal(result.source, 'fallback')
    assert.equal(result.viewModel.variant, 'invalid_username')
    assert.equal(avatarCalled, false)
  })

  it('maps not found errors to not_found variant', async () => {
    const result = await resolveOgData('gaearon', {
      getCachedScore: () => null,
      scoreUserWithMetadata: async () => {
        throw new GitHubNotFoundError()
      },
      fetchAvatarDataUri: async () => null,
    })

    assert.equal(result.source, 'fallback')
    assert.equal(result.viewModel.variant, 'not_found')
  })

  it('maps organization errors to organization variant', async () => {
    const result = await resolveOgData('github', {
      getCachedScore: () => null,
      scoreUserWithMetadata: async () => {
        throw new GitHubOrganizationError()
      },
      fetchAvatarDataUri: async () => null,
    })

    assert.equal(result.source, 'fallback')
    assert.equal(result.viewModel.variant, 'organization')
  })

  it('maps rate limit errors to rate_limited variant', async () => {
    const result = await resolveOgData('gaearon', {
      getCachedScore: () => null,
      scoreUserWithMetadata: async () => {
        throw new GitHubRateLimitError(
          'rate limit',
          '2026-03-01T00:10:00.000Z',
          429,
        )
      },
      fetchAvatarDataUri: async () => null,
    })

    assert.equal(result.source, 'fallback')
    assert.equal(result.viewModel.variant, 'rate_limited')
  })

  it('keeps rendering when avatar fetch fails', async () => {
    const liveScore = makeScore()

    const result = await resolveOgData('gaearon', {
      getCachedScore: () => liveScore,
      fetchAvatarDataUri: async () => {
        throw new Error('network issue')
      },
    })

    assert.equal(result.source, 'cache')
    assert.equal(result.viewModel.variant, 'result')
    if (result.viewModel.variant !== 'result') {
      assert.fail('expected result variant')
    }
    assert.equal(result.viewModel.avatarDataUri, null)
  })
})
