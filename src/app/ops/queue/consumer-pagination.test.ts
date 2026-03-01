import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CONSUMERS_PAGE_SIZE,
  clampPage,
  getPageRange,
  getTotalPages,
  pageWindow,
} from './consumer-pagination'

describe('getTotalPages', () => {
  it('returns 1 for empty items', () => {
    assert.equal(getTotalPages(0, CONSUMERS_PAGE_SIZE), 1)
  })

  it('returns 1 when total items are less than page size', () => {
    assert.equal(getTotalPages(6, CONSUMERS_PAGE_SIZE), 1)
  })

  it('returns exact pages for exact multiples', () => {
    assert.equal(getTotalPages(20, CONSUMERS_PAGE_SIZE), 2)
  })

  it('returns rounded-up pages for remainder totals', () => {
    assert.equal(getTotalPages(23, CONSUMERS_PAGE_SIZE), 3)
  })
})

describe('clampPage', () => {
  it('clamps below 1 to 1', () => {
    assert.equal(clampPage(0, 23, CONSUMERS_PAGE_SIZE), 1)
  })

  it('clamps above max to last page', () => {
    assert.equal(clampPage(99, 23, CONSUMERS_PAGE_SIZE), 3)
  })

  it('keeps page within valid bounds', () => {
    assert.equal(clampPage(2, 23, CONSUMERS_PAGE_SIZE), 2)
  })
})

describe('getPageRange', () => {
  it('returns 0-0 for empty data', () => {
    assert.deepEqual(getPageRange(1, 0, CONSUMERS_PAGE_SIZE), {
      start: 0,
      end: 0,
    })
  })

  it('returns 1-10 for first full page', () => {
    assert.deepEqual(getPageRange(1, 23, CONSUMERS_PAGE_SIZE), {
      start: 1,
      end: 10,
    })
  })

  it('returns 21-23 for final partial page', () => {
    assert.deepEqual(getPageRange(3, 23, CONSUMERS_PAGE_SIZE), {
      start: 21,
      end: 23,
    })
  })
})

describe('pageWindow', () => {
  it('returns all pages when total is small', () => {
    assert.deepEqual(pageWindow(3, 6), [1, 2, 3, 4, 5, 6])
  })

  it('returns deterministic ellipsis window for large totals', () => {
    assert.deepEqual(pageWindow(5, 10), [
      1,
      'ellipsis',
      4,
      5,
      6,
      'ellipsis',
      10,
    ])
  })
})
