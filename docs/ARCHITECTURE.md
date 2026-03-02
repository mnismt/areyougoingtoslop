# Architecture — areyougoingslop

How the server-side logic works, end to end.

---

## Request Flow

```
GET /u/[username]
  → render shell
  → POST /api/score/[username]/jobs
  → poll GET /api/score/jobs/[jobId] every ~1.2s
  → investigation view: detection protocol steps + live stats
  → progressive snapshots (discovering → enriching → finalizing)
  → final score card + stats strip + signal breakdown + commits

Legacy endpoint (still supported):
GET /api/score/[username]
  → rate-limit check (IP-based, 30 req / 10 min)
  → cache lookup (in-memory, 12h TTL, max 1000 entries)
  → fetchUserActivity() + computeSlopScore()
  → upsert leaderboard
  → cache write + return

GitHub transport inside ingestion:
  → createGitHubClient()
  → if REDIS_URL is set and no custom fetcher is passed:
      enqueue request to Redis Stream queue
      embedded worker executes GitHub request
      retries/backoff/rate-limit delay handled in queue worker
      response returned to ingestion via Redis result key
  → otherwise (tests/local fallback): direct GitHub HTTP call

Queue observability:
GET /api/queue/github
  → read-only queue snapshot (Redis + process-local diagnostics)
  → used by /ops/queue public monitoring page
```

Entrypoints:
- `src/server/api/score-handler.ts` (legacy synchronous API)
- `src/server/api/score-jobs.ts` (phase-1 async jobs + polling snapshots)
- `src/server/queue/github-request-queue.ts` (Redis Stream queue + embedded workers)
- `src/server/queue/github-queue-observer.ts` (queue health snapshot reader)
- `src/server/github/raw-client.ts` (direct GitHub HTTP client, worker-only in queue mode)

---

## 1. GitHub Ingestion (`src/server/github/`)

Fetches the last **180 days** of a user's public activity via GitHub REST API.

| Step | Detail |
|------|--------|
| **Validate** | Username regex: `^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37})$`, no trailing `-` or `--` |
| **Fetch events** | `GET /users/:name/events/public` — up to 5 pages (100/page) |
| **Filter** | Keep only `PushEvent` within 180-day window |
| **Normalize** | Extract individual commits from push payloads → `ContributionEvent[]` |
| **Expand repos** | `GET /users/:name/repos` and enumerate repo commits by `author + since/until` |
| **Dedupe** | Merge event-derived and repo-derived commits by `repo:sha` |
| **Enrich** | Fetch commit details (`GET /repos/:repo/commits/:sha`) for stats — up to 120 commits with token (30 without), 5 concurrent |
| **Transport** | Queue-backed GitHub requests when `REDIS_URL` is set; direct HTTP fallback when queue is disabled |

### Error handling
- `GitHubNotFoundError` → 404 to client
- `GitHubRateLimitError` → 429 to client, stops enrichment early
- Retries on 502/503/504 (up to 2 retries, exponential backoff)
- Events pagination limit (`422`) is handled gracefully and exposed as a limitation flag

### Queue mode reliability
- Queue implementation uses Redis Streams + consumer groups.
- Embedded workers run inside the same Node service process (no separate BullMQ service).
- Retries are delayed with exponential backoff and jitter.
- Rate-limit responses are rescheduled close to GitHub reset time.
- Stale in-flight jobs are reclaimed with `XAUTOCLAIM`.
- Worker/retry/timeout behavior can be tuned via `GITHUB_QUEUE_*` env vars.
- Public read-only queue telemetry is available at `/api/queue/github` and `/ops/queue`.
- Queue observer uses a dedicated read-only Redis client; compare Redis-backed and process-local counters together during dev reload debugging.
- Queue mode centralizes all GitHub requests, but score-job snapshots are still process-memory state.

### Queue observability snapshot contract

`GET /api/queue/github` returns:

- `health` + `warnings` for high-level status.
- `queue` + `consumers` from Redis stream/group metadata.
- `client_selection` (transport selection counters from `createGitHubClient`).
- `runtime` (process-local queue runtime counters).

Interpretation model:

- Redis-backed fields (`queue`, `consumers`) describe shared infrastructure state.
- Process-local fields (`client_selection`, `runtime`) describe behavior of the serving runtime.
- During burst load, expect `client_selection.queued`, `runtime.enqueued`, and `queue.processed_entries` to increase.

### Core type: `ContributionEvent`
```ts
{
  id: string           // "owner/repo:sha"
  type: 'commit'
  repo: string
  sha: string
  message: string
  occurredAt: string   // ISO date
  additions?: number
  deletions?: number
  filesChanged?: number
  isMerge?: boolean
}
```

---

## 2. Scoring Engine (`src/server/scoring/`)

Takes `ContributionEvent[]`, outputs a `SlopScoreResult`.

### 2.1 Recency Decay

Each event is weighted by age so recent behavior dominates:

| Window | Weight |
|--------|--------|
| 0–30 days | 1.0 |
| 31–90 days | 0.6 |
| 91–180 days | 0.3 |
| >180 days | excluded (weight 0) |

### 2.2 Signals

Four signals, each produces a **0–100 sub-score**:

| Signal | Weight | Logic |
|--------|--------|-------|
| **AI Attribution Hints** | 35% | Weighted evidence from commit-message attribution patterns. Strong signals (strength 1.0) are explicit attribution (`generated by`, `written with`, `co-authored-by` + tool), medium signals (strength 0.6) are usage context (`using/with/via` + tool). Plain tool mentions without attribution context score 0. Merge commits are excluded from this signal. |
| **Prompt Crumbs** | 20% | Evidence from AI-speak patterns in commit messages: `"as an ai language model"`, `"sure, here's"`, `"let me know if you"`, etc. |
| **Apathy Ratio** | 25% | Among large commits (≥250 lines), those with generic messages (`fix`, `update`, `wip`, `cleanup`, `chore`, `tweak`, `refactor`, or ≤6 chars). Conventional initial commit messages (`init`, `initial`, `initial commit`, `first commit`, `bootstrap`, `scaffold`, `initialize`, `initialise`, `project init`, `repo init`, `initial version`) are explicitly excluded. |
| **Churn** | 20% | Non-merge commits with both ≥350 additions and ≥350 deletions (wholesale rewrites) |

### 2.3 Final Score

Each signal score uses evidence-based normalization against a reference count (`referenceFlags = 10` by default):

```
avgWeight        = totalWeight / eventCount
referenceWeight  = avgWeight × referenceFlags
signal_score     = clamp((flaggedWeightSum / referenceWeight) × 100, 0, 100)
```

For `ai_keywords`, `flaggedWeightSum = Σ(recency_weight × attribution_strength)` per matched commit.
For `prompt_crumbs`, `apathy_ratio`, `churn`: `flaggedWeightSum = Σ recency_weight` per matched commit (binary flags).

This makes the score independent of total commit volume — absolute evidence counts, not the proportion of flagged commits.

```
weighted_score = Σ (signal_score × signal_weight)
slop_score = clamp(round(weighted_score), 0, 100)
```

### 2.4 Tiers

| Score | Tier | Tagline |
|-------|------|---------|
| 0–8 | the untouched keyboard | you debug with print statements. respect. |
| 9–22 | the tab-key athlete | autocomplete exists. you choose not to know. |
| 23–40 | the prompt-curious | just a couple of tokens between old you and new you |
| 41–60 | the context window regular | you have a system prompt and a ritual |
| 61–75 | the delegation economy | why code when you can orchestrate? |
| 76–90 | the fully cooked instance | running on tokens, not thoughts |
| 91–100 | the unsupervised slop machine | are they even there? hello? anyone home? |

### 2.5 Confidence

Based on data density:

| Condition | Level |
|-----------|-------|
| <5 events OR <30% have stats | `low` |
| <15 events OR <60% have stats | `medium` |
| Otherwise | `high` |

### 2.6 Output Contract: `SlopScoreResult`
```ts
{
  slop_score: number        // 0–100
  tier: string              // roast tier name (lowercase)
  tier_tagline: string      // one-line flavor text for the tier
  confidence: 'low' | 'medium' | 'high'
  top_signals: string[]     // up to 3 human-readable reasons (all lowercase)
  scoring_window: string    // "last 180 days"
  analyzed_commits: Array<{
    sha: string
    repo: string
    message: string
    occurred_at: string
    additions?: number
    deletions?: number
    flags: string[]         // lowercase flag identifiers
  }>
}
```

**Text formatting:** All UI-facing strings (`tier`, `tier_tagline`, `top_signals`, `flags`) must be lowercase per `docs/DESIGN.md` guidelines.

### 2.7 Async Job Snapshot Contract (Phase 1)
```ts
{
  job_id: string
  username: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  stage: 'queued' | 'discovering' | 'enriching' | 'finalizing'
  progress_percent: number
  result: SlopScoreResult | null
  coverage: {
    commits_discovered: number
    commits_enriched: number
    repos_scanned: number
    repos_total: number
    window_days: number
    is_partial: boolean
    sources_used: string[]
  }
  limits: {
    rate_limited: boolean
    events_pagination_limited: boolean
  }
}
```

### 2.8 Job Endpoint Error Semantics

- `GET /api/score/jobs/[job_id]` returns `404` with `error: "job_not_found"` when the job id does not exist.
- `snapshot.error.code === "not_found"` means the GitHub username itself does not exist.
- Score-job snapshots are retained in memory for 30 minutes (`JOB_RETENTION_MS`). After expiry (or process restart), polling can return `job_not_found`.

---

## 3. Caching (`src/server/cache/`)

In-memory `Map<string, CacheEntry>` keyed by lowercase username.

| Parameter | Value |
|-----------|-------|
| TTL | 12 hours |
| Max size | 1,000 entries |
| Eviction | Expired entries first, then LRU by expiry time |

Also includes an in-memory commit artifact cache (`repo:sha`) for commit-detail enrichment reuse.

---

## 4. Rate Limiting (`src/server/rate-limit/`)

In-memory sliding-window limiter per client IP.

| Parameter | Value |
|-----------|-------|
| Window | 10 minutes |
| Max requests | 30 per window |
| Key | `x-forwarded-for` or `x-real-ip` header |

---

## 5. Leaderboard (`src/server/leaderboard/`)

Redis-backed storage at key `ays:leaderboard:v1:state`.

| Parameter | Value |
|-----------|-------|
| Max entries | 200 |
| Min update interval | 10 min per user |
| Default query limit | 50 |
| Confidence floor | `medium` (filters out `low` confidence) |
| Sort | Score desc → most recent → username alpha |
| Concurrency | Optimistic concurrency control (WATCH/MULTI/EXEC) |

**Storage model:** The entire leaderboard is stored as a single JSON blob in Redis. Updates use optimistic locking: the key is WATCHed, the state is read, updated, and saved via MULTI/EXEC. If a concurrent update occurs, the transaction fails and retries automatically (up to 10 attempts with exponential backoff).

---

## 6. Performance Tracking (`src/server/perf/`)

Rolling buffer of last 200 score request durations. Exposes `getScoreP95()` for monitoring against the <10s target.
