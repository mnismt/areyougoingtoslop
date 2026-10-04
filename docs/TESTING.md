# Testing — areyougoingtoslop

How we test the project, what we test, and how to write new tests.

---

## Quick Reference

```bash
bun run test                # tsc -p tsconfig.test.json, then node --test over .test-build/
bun run test 2>&1 | grep -A20 'failing tests'   # just the failures
```

---

## Stack

| Tool | Role |
|------|------|
| **tsc + node --test** | Compile to CommonJS in `.test-build/`, run with Node's test runner (Node >= 22.5 for `node:sqlite`) |
| **node:test** | Test API (`describe`, `it`) |
| **node:assert/strict** | Assertions |
| **biome** | Formatting & linting (applied to test files too) |

We do **not** use Jest, Vitest, or any external test framework. All tests use the Node.js built-in test module.

---

## Test File Layout

Test files live next to the source they test, using the `.test.ts` suffix:

```
src/
  server/
    queue/
      github-queue-observer.ts       # Source
      github-queue-observer.test.ts  # Tests
    api/
      score-jobs.ts
      score-jobs.test.ts
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
- `computeSlopScore` — scoring engine (deterministic for same input + date)
- `mapScoreToTier` — score → tier label

**Pattern:** These functions are exported from their source modules (some specifically for testing). Tests import them directly and assert on return values.

```ts
import { mapScoreToTier } from './tier'

it('maps 0 to the bottom tier', () => {
  assert.equal(mapScoreToTier(0).name, 'the untouched keyboard')
})
```

### 2. Stateful modules

Durable state (jobs, leaderboard, caches, rate limits) lives behind `getEnv()`, so isolation is a fresh fake env per test (see section 4). The only process-local state left is the isolate-local commit-artifact cache.

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

### 4. Tests that touch Cloudflare bindings

Node cannot import `cloudflare:workers`, so app code reaches D1, KV and the Queue only through `getEnv()` in `src/server/env.ts`. Tests install an in-memory fake:

- `createFakeEnv()` (`src/server/testing/fake-env.ts`) gives `DB` as `node:sqlite` with every `migrations/*.sql` applied (tests run the real SQL), `CACHE` as a Map that mirrors KV's 60s minimum TTL, and `SCORE_QUEUE.send` pushing into `sent`.
- Call `setEnv(createFakeEnv().env)` in `beforeEach`; call `setEnv(null)` to test the bindings-missing path.
- GitHub calls are stubbed by replacing `globalThis.fetch`.

```ts
beforeEach(() => setEnv(createFakeEnv().env))

it('returns disabled without bindings', async () => {
  setEnv(null)
  const snapshot = await getGitHubQueueSnapshot()
  assert.equal(snapshot.health, 'disabled')
})
```

End-to-end behaviour under workerd (queue consumer, real D1/KV) is checked by hand with `bun run dev` / `bun run preview`; see `docs/queue-operations.md`.

---

## What We Test by Module

### Queue observer (`src/server/queue/`)

| Area | Tests | Approach |
|------|-------|----------|
| Snapshot | `getGitHubQueueSnapshot` counts, consumers, usernames | Seeded `score_jobs` rows in the fake D1 |
| Disabled / degraded | No bindings → `disabled`; `DB.prepare` throws → `degraded` | `setEnv(null)` / throwing fake |

### Score Jobs (`src/server/api/`)

| Area | Tests | Approach |
|------|-------|----------|
| Job creation | Valid username, invalid username, whitespace handling | Fake env, stubbed `fetch` |
| Deduplication | Second create for an active user returns the same job, one queue message | Partial unique index in D1 |
| Job retrieval | `getScoreJob` by ID, missing ID returns null, stale running job reads as failed, queued job in a long backlog stays queued | Fake D1 |
| Reuse | Just-completed job is returned from D1 when KV misses | Fake D1 + KV delete |
| Cache integration | Cached score → immediate completed snapshot | `await setCachedScore` → `createOrAttachScoreJob` |
| Consumer | `processScoreJob` no-op on missing/terminal job; happy path writes job, leaderboard row and KV score; GitHub 404 → failed `not_found`; duplicate delivery skipped, retry takes over; non-GitHub enrichment error → `server_error`, nothing cached; `failScoreJob` | Stubbed `fetch` |
| Snapshot shape / coverage | All fields present; `commits_enriched` from `additions`/`deletions` presence | Structure assertion |

### Scoring Engine (`src/server/scoring/`)

| Area | Tests | Approach |
|------|-------|----------|
| Score computation | Known inputs → known scores | Deterministic with fixed `now` date |
| Tier mapping | Score ranges → tier labels | Boundary values |
| Edge cases | Empty events, all-merge commits | Pure function |

### GitHub Client & Ingestion (`src/server/github/`)

| Area | Tests | Approach |
|------|-------|----------|
| Client | Custom fetcher is used; `User-Agent` header is sent (GitHub 403s without one, and Workers fetch adds none) | Fake fetcher |
| Ingestion pipeline | Mock fetcher → event normalization → merge → enrich | Fake `fetch` that returns canned GitHub API responses |

---

## Writing New Tests

### Conventions

1. **Co-locate** — test file sits next to source: `foo.ts` → `foo.test.ts`
2. **Imports** — use `node:test` (`describe`, `it`) and `node:assert/strict`
3. **Isolation** — each test cleans up its own state. Use a fresh `setEnv(createFakeEnv().env)` per test, env var save/restore as needed
4. **No mocking library** — we use manual fakes (fake `fetch`, direct globalThis manipulation). No sinon/jest mocks
5. **Determinism** — pass explicit `now` dates to avoid time-dependent flakes. Use ranges for jitter-affected values
6. **Format after writing** — run `bunx biome check --write <file>` on new test files

### Testing pure functions that are private

When a function is private but pure (no side effects, no I/O), export it for testing:

```ts
// At the bottom of the source file
export {
  myPureHelper,
  // ...
}
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
| `server/queue/github-queue-observer.test.ts` | 3 | D1-backed snapshot, stale rows excluded, disabled, degraded |
| `server/api/score-jobs.test.ts` | 25 | Jobs lifecycle, dedup, cache, staleness, claim, failure marking |
| `server/scoring/engine.test.ts` | 11 | Score computation, tiers |
| `server/github/ingestion.test.ts` | 4 | Ingestion pipeline |
| `server/github/client.test.ts` | 3 | Custom fetcher, User-Agent, commit trimming, retries |
| `server/leaderboard/store.test.ts` | 9 | Leaderboard I/O |
| `server/cache/score-cache.test.ts` | 5 | KV score cache |
| `server/cache/og-image-cache.test.ts` | 4 | KV OG image cache |
| `server/rate-limit/index.test.ts` | 5 | D1 rate limiter |
| `server/testing/fake-env.test.ts` | 3 | Fake bindings |
| `app/api/feedback/route.test.ts` | 5 | Feedback endpoint, 200-row cap |
| `app/api/og/og-data.test.ts` | 8 | OG data resolution, queued on miss |
| `app/api/og/og-card.test.ts` | 3 | OG card rendering |
| `app/api/og/[username]/route.test.ts` | 3 | OG route, pending cache header |
| `app/api/og/default/route.test.ts` | 1 | Default OG image |
| `app/api/queue/github/route.test.ts` | 3 | Queue status endpoint |
| `app/api/score/[username]/jobs/route.test.ts` | 4 | Job creation endpoint (202/200/400/429) |
| `app/api/score/jobs/[jobId]/route.test.ts` | 2 | Job polling endpoint |
| `app/ops/queue/consumer-pagination.test.ts` | 12 | Ops view pagination |
| other (`app/`, `data/`) | 6 | Heatmap helpers, lab notes, release hint |
| **Total (`bun run test`)** | **119** | |
