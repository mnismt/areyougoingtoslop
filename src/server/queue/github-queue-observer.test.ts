import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getGitHubQueueSnapshot,
  parseDelayedRetryTimestamp,
  parseRedisInfoRows,
  toNonNegativeInteger,
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

describe('parseRedisInfoRows edge cases', () => {
  it('returns [] for empty array input', () => {
    assert.deepEqual(parseRedisInfoRows([]), [])
  })

  it('returns [] for null input', () => {
    assert.deepEqual(parseRedisInfoRows(null), [])
  })

  it('returns [] for undefined input', () => {
    assert.deepEqual(parseRedisInfoRows(undefined), [])
  })

  it('returns [] for string input', () => {
    assert.deepEqual(parseRedisInfoRows('hello'), [])
  })

  it('skips null entries in the array', () => {
    assert.deepEqual(parseRedisInfoRows([null, null]), [])
  })

  it('returns only valid rows from mixed valid and invalid entries', () => {
    const rows = parseRedisInfoRows([
      ['name', 'worker-1', 'pending', '3'],
      null,
      42,
      'bad-entry',
      { name: 'worker-2' },
    ])
    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.name, 'worker-1')
    assert.equal(rows[1]?.name, 'worker-2')
  })

  it('parses pair-array with odd length (missing value for last key)', () => {
    const rows = parseRedisInfoRows([['name', 'w1', 'orphan']])
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.name, 'w1')
    assert.equal(rows[0]?.orphan, undefined)
  })

  it('skips pairs with non-string keys', () => {
    const rows = parseRedisInfoRows([[123, 'val', 'name', 'ok']])
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.name, 'ok')
    assert.equal(
      (rows[0] as Record<string, unknown>)[123 as unknown as string],
      undefined,
    )
  })
})

describe('toNonNegativeInteger', () => {
  it('returns 5 for number 5', () => {
    assert.equal(toNonNegativeInteger(5), 5)
  })

  it('returns 0 for number 0', () => {
    assert.equal(toNonNegativeInteger(0), 0)
  })

  it('clamps negative number -3 to 0', () => {
    assert.equal(toNonNegativeInteger(-3), 0)
  })

  it('truncates float 3.7 to 3', () => {
    assert.equal(toNonNegativeInteger(3.7), 3)
  })

  it('returns null for Infinity', () => {
    assert.equal(toNonNegativeInteger(Number.POSITIVE_INFINITY), null)
  })

  it('returns null for -Infinity', () => {
    assert.equal(toNonNegativeInteger(Number.NEGATIVE_INFINITY), null)
  })

  it('returns null for NaN', () => {
    assert.equal(toNonNegativeInteger(Number.NaN), null)
  })

  it('parses string "42" to 42', () => {
    assert.equal(toNonNegativeInteger('42'), 42)
  })

  it('parses string "0" to 0', () => {
    assert.equal(toNonNegativeInteger('0'), 0)
  })

  it('clamps string "-5" to 0', () => {
    assert.equal(toNonNegativeInteger('-5'), 0)
  })

  it('returns null for non-numeric string "abc"', () => {
    assert.equal(toNonNegativeInteger('abc'), null)
  })

  it('returns null for empty string', () => {
    assert.equal(toNonNegativeInteger(''), null)
  })

  it('returns null for null', () => {
    assert.equal(toNonNegativeInteger(null), null)
  })

  it('returns null for undefined', () => {
    assert.equal(toNonNegativeInteger(undefined), null)
  })

  it('returns null for boolean true', () => {
    assert.equal(toNonNegativeInteger(true), null)
  })

  it('returns null for object {}', () => {
    assert.equal(toNonNegativeInteger({}), null)
  })
})

describe('parseDelayedRetryTimestamp', () => {
  it('parses nested array format [["member", "score"]]', () => {
    assert.equal(
      parseDelayedRetryTimestamp([['member-json', '1700000000000']]),
      1700000000000,
    )
  })

  it('parses flat array format ["member", "score"]', () => {
    assert.equal(
      parseDelayedRetryTimestamp(['member-json', '1700000000000']),
      1700000000000,
    )
  })

  it('returns null for empty array', () => {
    assert.equal(parseDelayedRetryTimestamp([]), null)
  })

  it('returns null for null input', () => {
    assert.equal(parseDelayedRetryTimestamp(null), null)
  })

  it('returns null for undefined input', () => {
    assert.equal(parseDelayedRetryTimestamp(undefined), null)
  })

  it('returns null for nested array with non-numeric score', () => {
    assert.equal(parseDelayedRetryTimestamp([['member', 'abc']]), null)
  })

  it('returns null for single-element array where element is not an array', () => {
    assert.equal(parseDelayedRetryTimestamp(['only-one']), null)
  })

  it('returns null for nested array with single-element inner array', () => {
    assert.equal(parseDelayedRetryTimestamp([['only-member']]), null)
  })
})

describe('getGitHubQueueSnapshot edge cases', () => {
  it('returns disabled snapshot with health="disabled" when REDIS_URL is empty string', async () => {
    const previousRedisUrl = process.env.REDIS_URL
    process.env.REDIS_URL = ''

    try {
      const snapshot = await getGitHubQueueSnapshot()
      assert.equal(snapshot.health, 'disabled')
    } finally {
      process.env.REDIS_URL = previousRedisUrl
    }
  })

  it('disabled snapshot has correct shape', async () => {
    const previousRedisUrl = process.env.REDIS_URL
    process.env.REDIS_URL = ''

    try {
      const snapshot = await getGitHubQueueSnapshot()
      assert.equal(snapshot.enabled, false)
      assert.equal(snapshot.queue.workers_configured > 0, true)
      assert.deepEqual(snapshot.consumers, [])
    } finally {
      process.env.REDIS_URL = previousRedisUrl
    }
  })

  it('disabled snapshot warnings array is non-empty', async () => {
    const previousRedisUrl = process.env.REDIS_URL
    process.env.REDIS_URL = ''

    try {
      const snapshot = await getGitHubQueueSnapshot()
      assert.equal(snapshot.warnings.length > 0, true)
    } finally {
      process.env.REDIS_URL = previousRedisUrl
    }
  })
})
