import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildHeatmapGrid,
  getFilterStartTime,
  toDateKey,
} from './slop-heatmap-helpers'

describe('slop-heatmap-helpers', () => {
  it('builds a grid that always reaches today', () => {
    const now = new Date('2026-03-11T15:45:00')
    const { weeks } = buildHeatmapGrid(7, now)

    const keys = weeks.flat().filter(Boolean)
    assert.ok(keys.length > 0)
    assert.equal(keys.at(-1), toDateKey(now))
  })

  it('anchors filter start to the start of the current day', () => {
    const now = new Date('2026-03-11T15:45:00')
    const cutoff = new Date(getFilterStartTime(7, now))

    assert.equal(cutoff.getFullYear(), 2026)
    assert.equal(cutoff.getMonth(), 2)
    assert.equal(cutoff.getDate(), 4)
    assert.equal(cutoff.getHours(), 0)
    assert.equal(cutoff.getMinutes(), 0)
    assert.equal(cutoff.getSeconds(), 0)
    assert.equal(cutoff.getMilliseconds(), 0)
  })
})
