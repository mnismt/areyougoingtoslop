import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getGitHubQueueSnapshot,
  parseRedisInfoRows,
} from './github-queue-observer'

describe('parseRedisInfoRows', () => {
  it('normalizes pair-array rows into objects', () => {
    const rows = parseRedisInfoRows([
      ['name', 'ays:gh:req:workers', 'pending', '7', 'lag', 3],
    ])

    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.name, 'ays:gh:req:workers')
    assert.equal(rows[0]?.pending, '7')
    assert.equal(rows[0]?.lag, 3)
  })

  it('passes through object rows', () => {
    const rows = parseRedisInfoRows([
      {
        name: 'ays-gh-1',
        pending: 2,
        idle: 120,
      },
    ])

    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.name, 'ays-gh-1')
    assert.equal(rows[0]?.pending, 2)
  })
})

describe('getGitHubQueueSnapshot', () => {
  it('returns disabled snapshot when REDIS_URL is missing', async () => {
    const previousRedisUrl = process.env.REDIS_URL
    process.env.REDIS_URL = ''

    try {
      const snapshot = await getGitHubQueueSnapshot()
      assert.equal(snapshot.enabled, false)
      assert.equal(snapshot.health, 'disabled')
      assert.equal(snapshot.queue.workers_configured > 0, true)
    } finally {
      process.env.REDIS_URL = previousRedisUrl
    }
  })
})
