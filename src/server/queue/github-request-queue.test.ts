import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getGitHubQueueRuntimeMetrics } from './github-request-queue'

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
