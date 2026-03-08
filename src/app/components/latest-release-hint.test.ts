import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getLatestVersionedLabNote } from '../../data/lab-notes'
import { LatestReleaseHint } from './latest-release-hint'

describe('LatestReleaseHint', () => {
  it('renders a compact link to the latest versioned lab note', () => {
    const latestRelease = getLatestVersionedLabNote()
    const html = renderToStaticMarkup(
      createElement(LatestReleaseHint, { entry: latestRelease }),
    )

    assert.ok(html.includes('lab notes'))
    assert.ok(html.includes('v0.0.2'))
    assert.ok(html.includes('search got faster'))
    assert.ok(html.includes('/lab-notes#note-v0-0-2'))
  })
})
