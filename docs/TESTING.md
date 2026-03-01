# Testing — areyougoingslop

How we test the project, what we test, and how to write new tests.

---

## Quick Reference

```bash
bun test                    # Run all tests
bun test src/server/queue   # Run tests in a directory
bun test src/server/queue/github-request-queue.test.ts  # Run a specific file
```

---

## Stack

| Tool | Role |
|------|------|
| **bun test** | Test runner (built into bun runtime) |
| **node:test** | Test API (`describe`, `it`) |
| **node:assert/strict** | Assertions |
| **biome** | Formatting & linting (applied to test files too) |

We do **not** use Jest, Vitest, or any external test framework. All tests use the Node.js built-in test module, which bun supports natively.

---

## Test File Layout

Test files live next to the source they test, using the `.test.ts` suffix:

```
src/
  server/
    queue/
      github-request-queue.ts        # Source
      github-request-queue.test.ts   # Tests
      github-queue-observer.ts
      github-queue-observer.test.ts
    api/
      score-jobs.ts
      score-jobs.test.ts
      score-handler.ts
      score-handler.test.ts
    scoring/
      engine.ts
      engine.test.ts
    github/
      client.ts
      client.test.ts
      ingestion.ts
      ingestion.test.ts
    leaderboard/
      store.ts
      store.test.ts
  app/
    api/
      feedback/route.test.ts
      queue/github/route.test.ts
      score/jobs/[jobId]/route.test.ts
```

---

## Test Categories

### 1. Pure Function Unit Tests (no I/O)

The bulk of our tests. These exercise deterministic functions with no side effects — parsing, serialization, computation, validation.

**Examples:**
- `parseQueueRequest` — JSON → typed request or null
- `parseXReadResponse` / `parseXAutoClaimResponse` — Redis response shapes → typed messages
- `serializeQueueError` / `restoreQueueError` — error class → wire format → error class roundtrip
- `isRetryableError` / `computeRetryDelayMs` — retry decision logic and backoff math
- `parseRedisInfoRows` — Redis XINFO response normalization
- `toNonNegativeInteger` / `parseDelayedRetryTimestamp` — observer parsing helpers
- `computeSlopScore` — scoring engine (deterministic for same input + date)
- `mapScoreToTier` — score → tier label

**Pattern:** These functions are exported from their source modules (some specifically for testing). Tests import them directly and assert on return values.

```ts
import { parseQueueRequest } from './github-request-queue'

it('parses valid request JSON', () => {
  const result = parseQueueRequest(JSON.stringify({
    request_id: 'abc',
    kind: 'get_user',
    payload: { username: 'octocat' },
    attempt: 0,
    enqueued_at: '2026-01-01T00:00:00Z',
  }))
  assert.equal(result?.kind, 'get_user')
})
```

### 2. In-Memory State Tests (globalThis singletons)

Several modules use `globalThis` singletons for state (queue worker state, score job registry). Tests manipulate these directly.

**Key pattern — save and restore globalThis state:**

```ts
it('normalizes legacy worker state', () => {
  const runtime = globalThis as typeof globalThis & {
    __aysGhQueueState?: unknown
  }
  const previous = runtime.__aysGhQueueState

  runtime.__aysGhQueueState = { started: true }

  try {
    const metrics = getGitHubQueueRuntimeMetrics()
    assert.equal(metrics.started, true)
    assert.equal(metrics.worker_starts, 0) // backfilled
  } finally {
    runtime.__aysGhQueueState = previous
  }
})
```

**Key pattern — use cleanup functions:**

Score jobs expose `clearScoreJobs()` for test isolation. Always call it at the start of each test:

```ts
it('creates a job', async () => {
  await clearScoreJobs()
  clearScoreCache()
  // ... test logic
})
```

### 3. API Route Tests (handler-level)

Test Next.js route handlers by calling them directly with constructed `Request` objects. No HTTP server needed.

```ts
it('returns 404 for missing job', async () => {
  const response = await GET(new Request('http://localhost'), {
    params: Promise.resolve({ jobId: 'missing' }),
  })
  assert.equal(response.status, 404)
  const body = await response.json()
  assert.equal(body.error, 'job_not_found')
})
```

### 4. Integration Tests with External Dependencies

Tests that need Redis or network access. Currently limited — the queue worker loops, leader election, and BLPOP flows are not unit-tested because they require a live Redis instance.

**Convention:** When a test needs `REDIS_URL` to be unset (to test the no-Redis fallback path), temporarily override it:

```ts
it('returns disabled when no Redis', async () => {
  const prev = process.env.REDIS_URL
  process.env.REDIS_URL = ''
  try {
    const snapshot = await getGitHubQueueSnapshot()
    assert.equal(snapshot.health, 'disabled')
  } finally {
    process.env.REDIS_URL = prev
  }
})
```

---

## What We Test by Module

### Queue System (`src/server/queue/`)

The core infrastructure. Highest test density.

| Area | Tests | Approach |
|------|-------|----------|
| Stream message parsing | `parseQueueRequest`, `parseStreamFieldsToRequest`, `parseXReadResponse`, `parseXAutoClaimResponse` | Pure function — all Redis response shapes, malformed input, edge cases |
| Error serialization | `serializeQueueError`, `restoreQueueError` | Roundtrip through JSON for each error class (`GitHubRateLimitError`, `GitHubNotFoundError`, `GitHubError`, plain `Error`) |
| Retry logic | `isRetryableError`, `computeRetryDelayMs` | Decision matrix (status codes, error types) and backoff bounds (exponential growth, jitter ranges, `reset_at` handling, max cap) |
| Metrics normalization | `getGitHubQueueRuntimeMetrics` | Legacy state migration, partial metric objects |
| Observer parsing | `parseRedisInfoRows`, `toNonNegativeInteger`, `parseDelayedRetryTimestamp` | Redis XINFO shapes, type coercion, edge inputs |
| Observer snapshot | `getGitHubQueueSnapshot` | Disabled state when no Redis |

**Not yet tested (requires Redis):** worker loops, BLPOP response flow, leader election, backpressure (`INCR`/`DECR` inflight), delayed scheduler promotion, `XAUTOCLAIM` reclaim loop.

### Score Jobs (`src/server/api/`)

| Area | Tests | Approach |
|------|-------|----------|
| Job creation | Valid username, invalid username, whitespace handling | In-memory, no Redis |
| Deduplication | Same username returns existing job | Uses cached scores to get synchronous completion |
| Job retrieval | `getScoreJob` by ID, missing ID returns null | In-memory registry |
| Cache integration | Cached score → immediate completed snapshot | `setCachedScore` → `createOrAttachScoreJob` |
| Snapshot shape | All fields present with correct types | Structure assertion |
| Coverage computation | `commits_enriched` count from `additions`/`deletions` presence | Cached score with mixed commit data |
| Cleanup | `clearScoreJobs` empties registry | Verify `getScoreJob` returns null after clear |

### Scoring Engine (`src/server/scoring/`)

| Area | Tests | Approach |
|------|-------|----------|
| Score computation | Known inputs → known scores | Deterministic with fixed `now` date |
| Tier mapping | Score ranges → tier labels | Boundary values |
| Edge cases | Empty events, all-merge commits | Pure function |

### GitHub Client & Ingestion (`src/server/github/`)

| Area | Tests | Approach |
|------|-------|----------|
| Client selection | Queue vs raw based on `REDIS_URL` | Env var toggling |
| Ingestion pipeline | Mock fetcher → event normalization → merge → enrich | Fake `fetch` that returns canned GitHub API responses |

---

## Writing New Tests

### Conventions

1. **Co-locate** — test file sits next to source: `foo.ts` → `foo.test.ts`
2. **Imports** — use `node:test` (`describe`, `it`) and `node:assert/strict`
3. **Isolation** — each test cleans up its own state. Use `clearScoreJobs()`, `clearScoreCache()`, env var save/restore as needed
4. **No mocking library** — we use manual fakes (fake `fetch`, direct globalThis manipulation). No sinon/jest mocks
5. **Determinism** — pass explicit `now` dates to avoid time-dependent flakes. Use ranges for jitter-affected values
6. **Format after writing** — run `bunx biome check --write <file>` on new test files

### Testing pure functions that are private

When a function is private but pure (no side effects, no I/O), export it for testing:

```ts
// At the bottom of the source file
export {
  parseQueueRequest,
  serializeQueueError,
  // ...
}
```

This is the convention used in `github-request-queue.ts` and `github-queue-observer.ts`.

### Testing with jitter / randomness

`computeRetryDelayMs` includes `Math.random()` jitter. Test with bounds, not exact values:

```ts
it('attempt 0 delay is within expected range', () => {
  const delay = computeRetryDelayMs({ name: 'Error', message: 'fail' }, 0)
  assert.ok(delay >= 350, `delay ${delay} should be >= base`)
  assert.ok(delay <= 750, `delay ${delay} should be <= base + jitter + margin`)
})
```

### Template for a new test file

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { myFunction } from './my-module'

describe('myFunction', () => {
  it('handles the happy path', () => {
    const result = myFunction('valid-input')
    assert.equal(result, 'expected-output')
  })

  it('returns null for invalid input', () => {
    assert.equal(myFunction(''), null)
  })
})
```

---

## Current Coverage Summary

| File | Tests | Focus |
|------|-------|-------|
| `server/queue/github-request-queue.test.ts` | 60 | Parsing, errors, retry, roundtrip |
| `server/queue/github-queue-observer.test.ts` | 38 | Observer parsing, snapshot |
| `server/api/score-jobs.test.ts` | 13 | Jobs lifecycle, dedup, cache |
| `server/api/score-handler.test.ts` | 5 | Legacy score handler |
| `server/scoring/engine.test.ts` | 8 | Score computation |
| `server/github/ingestion.test.ts` | 4 | Ingestion pipeline |
| `server/github/client.test.ts` | 2 | Client selection |
| `server/leaderboard/store.test.ts` | 3 | Leaderboard I/O |
| `app/api/feedback/route.test.ts` | 2 | Feedback endpoint |
| `app/api/queue/github/route.test.ts` | 1 | Queue status endpoint |
| `app/api/score/jobs/[jobId]/route.test.ts` | 1 | Job polling endpoint |
| **Total** | **137** | |
