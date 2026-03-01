import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GitHubError,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from '../github/errors'
import {
  computeRetryDelayMs,
  getGitHubQueueRuntimeMetrics,
  isRetryableError,
  parseQueueRequest,
  parseStreamFieldsToRequest,
  parseXAutoClaimResponse,
  parseXReadResponse,
  restoreQueueError,
  serializeQueueError,
} from './github-request-queue'

describe('getGitHubQueueRuntimeMetrics', () => {
  it('normalizes legacy worker state without metrics', () => {
    const runtime = globalThis as typeof globalThis & {
      __aysGhQueueState?: unknown
    }
    const previous = runtime.__aysGhQueueState

    runtime.__aysGhQueueState = {
      commandClient: null,
      started: true,
      startPromise: null,
    }

    try {
      const metrics = getGitHubQueueRuntimeMetrics()
      assert.equal(metrics.started, true)
      assert.equal(metrics.worker_starts, 0)
      assert.equal(metrics.enqueued, 0)
      assert.equal(metrics.worker_processed, 0)
      assert.equal(metrics.responses_stored, 0)
      assert.equal(metrics.responses_consumed, 0)
      assert.equal(metrics.retries_scheduled, 0)
      assert.equal(metrics.timeouts, 0)
    } finally {
      runtime.__aysGhQueueState = previous
    }
  })

  it('backfills missing metric fields while preserving existing counters', () => {
    const runtime = globalThis as typeof globalThis & {
      __aysGhQueueState?: unknown
    }
    const previous = runtime.__aysGhQueueState

    runtime.__aysGhQueueState = {
      commandClient: null,
      started: false,
      startPromise: null,
      metrics: {
        enqueued: 12,
      },
    }

    try {
      const metrics = getGitHubQueueRuntimeMetrics()
      assert.equal(metrics.started, false)
      assert.equal(metrics.enqueued, 12)
      assert.equal(metrics.worker_starts, 0)
      assert.equal(metrics.responses_stored, 0)
      assert.equal(metrics.timeouts, 0)
    } finally {
      runtime.__aysGhQueueState = previous
    }
  })
})

const validRequest = (overrides?: Record<string, unknown>) =>
  JSON.stringify({
    request_id: 'abc-123',
    kind: 'get_user',
    payload: { username: 'octocat' },
    attempt: 0,
    enqueued_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })

describe('parseQueueRequest', () => {
  it('parses valid complete JSON with kind=get_user', () => {
    const result = parseQueueRequest(validRequest())
    assert.ok(result)
    assert.equal(result.request_id, 'abc-123')
    assert.equal(result.kind, 'get_user')
    assert.deepEqual(result.payload, { username: 'octocat' })
    assert.equal(result.attempt, 0)
  })

  it('parses valid JSON with kind=list_repo_commits and nested query', () => {
    const result = parseQueueRequest(
      validRequest({
        kind: 'list_repo_commits',
        payload: {
          repo_full_name: 'octocat/hello',
          query: {
            author: 'octocat',
            since: '2026-01-01',
            until: '2026-02-01',
            page: 1,
          },
        },
      }),
    )
    assert.ok(result)
    assert.equal(result.kind, 'list_repo_commits')
  })

  for (const kind of [
    'get_user',
    'list_user_public_events',
    'list_user_repos',
    'list_repo_commits',
    'get_commit',
  ] as const) {
    it(`accepts kind=${kind}`, () => {
      const result = parseQueueRequest(
        validRequest({ kind, payload: { x: 1 } }),
      )
      assert.ok(result)
      assert.equal(result.kind, kind)
    })
  }

  it('returns null when request_id is missing', () => {
    const raw = validRequest()
    const obj = JSON.parse(raw)
    delete obj.request_id
    assert.equal(parseQueueRequest(JSON.stringify(obj)), null)
  })

  it('returns null when kind is missing', () => {
    const raw = validRequest()
    const obj = JSON.parse(raw)
    delete obj.kind
    assert.equal(parseQueueRequest(JSON.stringify(obj)), null)
  })

  it('returns null for invalid kind string', () => {
    assert.equal(
      parseQueueRequest(validRequest({ kind: 'invalid_kind' })),
      null,
    )
  })

  it('returns null when payload is missing', () => {
    const raw = validRequest()
    const obj = JSON.parse(raw)
    delete obj.payload
    assert.equal(parseQueueRequest(JSON.stringify(obj)), null)
  })

  it('returns null when attempt is not a number', () => {
    assert.equal(parseQueueRequest(validRequest({ attempt: 'zero' })), null)
  })

  it('returns null for non-JSON string', () => {
    assert.equal(parseQueueRequest('not json'), null)
  })

  it('returns null for empty string', () => {
    assert.equal(parseQueueRequest(''), null)
  })
})

describe('parseStreamFieldsToRequest', () => {
  it('parses array with [job, <valid JSON>]', () => {
    const result = parseStreamFieldsToRequest(['job', validRequest()])
    assert.ok(result)
    assert.equal(result.request_id, 'abc-123')
  })

  it('finds job key even when other keys come first', () => {
    const result = parseStreamFieldsToRequest([
      'other',
      'value',
      'job',
      validRequest(),
    ])
    assert.ok(result)
    assert.equal(result.kind, 'get_user')
  })

  it('returns null when no job key exists', () => {
    assert.equal(parseStreamFieldsToRequest(['foo', 'bar']), null)
  })

  it('returns null for non-array input', () => {
    assert.equal(parseStreamFieldsToRequest('not an array'), null)
  })

  it('returns null when job value is not a string', () => {
    assert.equal(parseStreamFieldsToRequest(['job', 123]), null)
  })

  it('returns null for empty array', () => {
    assert.equal(parseStreamFieldsToRequest([]), null)
  })
})

describe('parseXReadResponse', () => {
  it('parses standard XREADGROUP response shape', () => {
    const response = [['stream-key', [['msg-id-1', ['job', validRequest()]]]]]
    const result = parseXReadResponse(response)
    assert.equal(result.length, 1)
    assert.equal(result[0].messageId, 'msg-id-1')
    assert.equal(result[0].request.request_id, 'abc-123')
  })

  it('parses multiple entries in one stream', () => {
    const response = [
      [
        'stream-key',
        [
          ['msg-1', ['job', validRequest()]],
          ['msg-2', ['job', validRequest({ request_id: 'def-456' })]],
        ],
      ],
    ]
    const result = parseXReadResponse(response)
    assert.equal(result.length, 2)
    assert.equal(result[0].messageId, 'msg-1')
    assert.equal(result[1].messageId, 'msg-2')
    assert.equal(result[1].request.request_id, 'def-456')
  })

  it('skips malformed entry (missing fields)', () => {
    const response = [['stream-key', [['msg-1']]]]
    const result = parseXReadResponse(response)
    assert.equal(result.length, 0)
  })

  it('returns empty array for non-array response', () => {
    assert.deepEqual(parseXReadResponse('bad'), [])
  })

  it('returns empty array for null response', () => {
    assert.deepEqual(parseXReadResponse(null), [])
  })

  it('skips entry with non-string messageId', () => {
    const response = [['stream-key', [[123, ['job', validRequest()]]]]]
    const result = parseXReadResponse(response)
    assert.equal(result.length, 0)
  })

  it('skips entry with invalid job JSON', () => {
    const response = [['stream-key', [['msg-1', ['job', 'not json']]]]]
    const result = parseXReadResponse(response)
    assert.equal(result.length, 0)
  })
})

describe('parseXAutoClaimResponse', () => {
  it('parses standard XAUTOCLAIM shape', () => {
    const response = ['0-0', [['msg-id', ['job', validRequest()]]], []]
    const result = parseXAutoClaimResponse(response)
    assert.equal(result.length, 1)
    assert.equal(result[0].messageId, 'msg-id')
  })

  it('returns empty array for empty entries', () => {
    const response = ['0-0', [], []]
    assert.deepEqual(parseXAutoClaimResponse(response), [])
  })

  it('returns empty array when response too short', () => {
    assert.deepEqual(parseXAutoClaimResponse(['0-0']), [])
  })

  it('returns empty array for non-array response', () => {
    assert.deepEqual(parseXAutoClaimResponse('bad'), [])
  })
})

describe('serializeQueueError', () => {
  it('serializes GitHubRateLimitError with reset_at and status', () => {
    const err = new GitHubRateLimitError(
      'rate limited',
      '2026-01-01T01:00:00Z',
      429,
    )
    const serialized = serializeQueueError(err)
    assert.equal(serialized.name, 'GitHubRateLimitError')
    assert.equal(serialized.message, 'rate limited')
    assert.equal(serialized.status, 429)
    assert.equal(serialized.reset_at, '2026-01-01T01:00:00Z')
  })

  it('serializes GitHubNotFoundError with status 404', () => {
    const err = new GitHubNotFoundError('not found')
    const serialized = serializeQueueError(err)
    assert.equal(serialized.name, 'GitHubNotFoundError')
    assert.equal(serialized.status, 404)
  })

  it('serializes GitHubError with custom status', () => {
    const err = new GitHubError('server error', 502)
    const serialized = serializeQueueError(err)
    assert.equal(serialized.name, 'GitHubError')
    assert.equal(serialized.status, 502)
    assert.equal(serialized.message, 'server error')
  })

  it('serializes plain Error', () => {
    const err = new Error('oops')
    const serialized = serializeQueueError(err)
    assert.equal(serialized.name, 'Error')
    assert.equal(serialized.message, 'oops')
  })

  it('handles non-error value (string)', () => {
    const serialized = serializeQueueError('some string')
    assert.equal(serialized.name, 'Error')
    assert.equal(serialized.message, 'Unknown queue error')
  })

  it('handles non-error value (null)', () => {
    const serialized = serializeQueueError(null)
    assert.equal(serialized.name, 'Error')
    assert.equal(serialized.message, 'Unknown queue error')
  })
})

describe('restoreQueueError', () => {
  it('restores GitHubRateLimitError with resetAt', () => {
    const restored = restoreQueueError({
      name: 'GitHubRateLimitError',
      message: 'rate limited',
      status: 429,
      reset_at: '2026-01-01T01:00:00Z',
    })
    assert.ok(restored instanceof GitHubRateLimitError)
    assert.equal(restored.message, 'rate limited')
    assert.equal(
      (restored as GitHubRateLimitError).resetAt,
      '2026-01-01T01:00:00Z',
    )
  })

  it('restores GitHubNotFoundError', () => {
    const restored = restoreQueueError({
      name: 'GitHubNotFoundError',
      message: 'not found',
    })
    assert.ok(restored instanceof GitHubNotFoundError)
  })

  it('restores GitHubError with status', () => {
    const restored = restoreQueueError({
      name: 'GitHubError',
      message: 'server error',
      status: 502,
    })
    assert.ok(restored instanceof GitHubError)
    assert.equal((restored as GitHubError).status, 502)
  })

  it('restores plain Error for unknown name', () => {
    const restored = restoreQueueError({
      name: 'Error',
      message: 'generic',
    })
    assert.ok(restored instanceof Error)
    assert.ok(!(restored instanceof GitHubError))
    assert.equal(restored.message, 'generic')
  })

  it('roundtrips GitHubRateLimitError through serialize/restore', () => {
    const original = new GitHubRateLimitError(
      'limit hit',
      '2026-06-01T00:00:00Z',
      429,
    )
    const restored = restoreQueueError(serializeQueueError(original))
    assert.ok(restored instanceof GitHubRateLimitError)
    assert.equal(restored.message, 'limit hit')
    assert.equal(
      (restored as GitHubRateLimitError).resetAt,
      '2026-06-01T00:00:00Z',
    )
  })
})

describe('isRetryableError', () => {
  it('returns true for GitHubRateLimitError', () => {
    assert.equal(
      isRetryableError({
        name: 'GitHubRateLimitError',
        message: 'rate limited',
      }),
      true,
    )
  })

  it('returns true for status 500', () => {
    assert.equal(
      isRetryableError({ name: 'Error', message: 'fail', status: 500 }),
      true,
    )
  })

  it('returns true for status 502', () => {
    assert.equal(
      isRetryableError({ name: 'Error', message: 'fail', status: 502 }),
      true,
    )
  })

  it('returns true for status 429', () => {
    assert.equal(
      isRetryableError({ name: 'Error', message: 'fail', status: 429 }),
      true,
    )
  })

  it('returns false for status 404', () => {
    assert.equal(
      isRetryableError({ name: 'Error', message: 'fail', status: 404 }),
      false,
    )
  })

  it('returns false for status 400', () => {
    assert.equal(
      isRetryableError({ name: 'Error', message: 'fail', status: 400 }),
      false,
    )
  })

  it('returns true when no status (unknown errors retryable)', () => {
    assert.equal(isRetryableError({ name: 'Error', message: 'fail' }), true)
  })
})

describe('computeRetryDelayMs', () => {
  it('returns delay in reasonable range for attempt 0', () => {
    const delay = computeRetryDelayMs(
      { name: 'Error', message: 'fail', status: 500 },
      0,
    )
    assert.ok(delay >= 350, `delay ${delay} should be >= 350`)
    assert.ok(delay < 750, `delay ${delay} should be < 750`)
  })

  it('returns larger delay for attempt 2 than attempt 0', () => {
    const err = { name: 'Error', message: 'fail', status: 500 }
    const delays0: number[] = []
    const delays2: number[] = []
    for (let i = 0; i < 20; i++) {
      delays0.push(computeRetryDelayMs(err, 0))
      delays2.push(computeRetryDelayMs(err, 2))
    }
    const avg0 = delays0.reduce((a, b) => a + b, 0) / delays0.length
    const avg2 = delays2.reduce((a, b) => a + b, 0) / delays2.length
    assert.ok(
      avg2 > avg0,
      `avg attempt 2 (${avg2}) should be > avg attempt 0 (${avg0})`,
    )
  })

  it('accounts for reset_at in the future', () => {
    const futureReset = new Date(Date.now() + 5_000).toISOString()
    const delay = computeRetryDelayMs(
      {
        name: 'GitHubRateLimitError',
        message: 'rate limited',
        reset_at: futureReset,
      },
      0,
    )
    assert.ok(
      delay >= 4_000,
      `delay ${delay} should be >= 4000 for ~5s future reset`,
    )
    assert.ok(
      delay <= 6_000,
      `delay ${delay} should be <= 6000 for ~5s future reset`,
    )
  })

  it('falls back to exponential backoff when reset_at is in the past', () => {
    const pastReset = new Date(Date.now() - 10_000).toISOString()
    const delay = computeRetryDelayMs(
      {
        name: 'GitHubRateLimitError',
        message: 'rate limited',
        reset_at: pastReset,
      },
      0,
    )
    assert.ok(delay >= 350, `delay ${delay} should be >= 350`)
    assert.ok(delay < 750, `delay ${delay} should be < 750`)
  })

  it('caps delay at MAX_RETRY_DELAY_MS for high attempt', () => {
    const delay = computeRetryDelayMs(
      { name: 'Error', message: 'fail', status: 500 },
      20,
    )
    assert.ok(delay <= 30_000, `delay ${delay} should be <= 30000`)
  })
})

describe('error serialization roundtrip', () => {
  it('roundtrips GitHubRateLimitError through JSON', () => {
    const original = new GitHubRateLimitError(
      'rate limited',
      '2026-01-01T01:00:00Z',
      429,
    )
    const json = JSON.stringify(serializeQueueError(original))
    const restored = restoreQueueError(JSON.parse(json))
    assert.ok(restored instanceof GitHubRateLimitError)
    assert.equal(restored.message, 'rate limited')
    assert.equal(
      (restored as GitHubRateLimitError).resetAt,
      '2026-01-01T01:00:00Z',
    )
    assert.equal((restored as GitHubRateLimitError).status, 429)
  })

  it('roundtrips GitHubNotFoundError through JSON', () => {
    const original = new GitHubNotFoundError('missing resource')
    const json = JSON.stringify(serializeQueueError(original))
    const restored = restoreQueueError(JSON.parse(json))
    assert.ok(restored instanceof GitHubNotFoundError)
    assert.equal((restored as GitHubNotFoundError).status, 404)
  })

  it('roundtrips GitHubError with status 503 through JSON', () => {
    const original = new GitHubError('service unavailable', 503)
    const json = JSON.stringify(serializeQueueError(original))
    const restored = restoreQueueError(JSON.parse(json))
    assert.ok(restored instanceof GitHubError)
    assert.equal((restored as GitHubError).status, 503)
  })

  it('roundtrips generic Error through JSON', () => {
    const original = new Error('something broke')
    const json = JSON.stringify(serializeQueueError(original))
    const restored = restoreQueueError(JSON.parse(json))
    assert.ok(restored instanceof Error)
    assert.ok(!(restored instanceof GitHubError))
    assert.equal(restored.message, 'something broke')
  })
})
