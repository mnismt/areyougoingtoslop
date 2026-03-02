import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderOgCard } from './og-card'

describe('renderOgCard', () => {
  it('renders the result variant content', () => {
    const html = renderToStaticMarkup(
      renderOgCard({
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
        topSignals: [
          'suspicious velocity spikes',
          'massive diffs, zero explanation',
        ],
      }),
    )

    assert.ok(html.includes('@gaearon'))
    assert.ok(html.includes('the tab-key athlete'))
    assert.ok(html.includes('18'))
    assert.ok(html.includes('high confidence'))
    assert.ok(html.includes('suspicious velocity spikes'))
    assert.ok(html.includes('commits inspected'))
  })

  it('renders fallback variant content', () => {
    const html = renderToStaticMarkup(
      renderOgCard({
        variant: 'not_found',
        username: 'missing-user',
        avatarDataUri: null,
        title: 'ghost account',
        subtitle: "that username doesn't exist.",
      }),
    )

    assert.ok(html.includes('ghost account'))
    assert.ok(html.includes('@missing-user'))
    assert.ok(html.includes('that username doesn&#x27;t exist.'))
  })

  it('renders homepage preview content for fallback without username', () => {
    const html = renderToStaticMarkup(
      renderOgCard({
        variant: 'unavailable',
        title: 'playful slop score',
        subtitle: 'we scan public github activity and deliver a fun roast.',
      }),
    )

    assert.ok(html.includes('are you going to'))
    assert.ok(html.includes('inspect the vibes'))
    assert.ok(html.includes('hall of shame'))
    assert.ok(html.includes('@Rich-Harris'))
  })
})
