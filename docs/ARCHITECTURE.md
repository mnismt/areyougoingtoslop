# Architecture — areyougoingtoslop

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

Score job execution (Cloudflare Workers):
  → POST /api/score/[username]/jobs inserts a `queued` row in D1 `score_jobs`
    (partial unique index = one active job per username) and sends
    {job_id, username} to the `areyougoingtoslop-score-jobs` Queue. An active job, or a job
    completed in the last 30 min, is returned instead (D1 sees its own writes; KV may not)
  → worker/index.ts queue() consumer (max_concurrency 4) runs the scorer,
    persisting debounced progress snapshots to D1
  → on success: KV score cache, D1 leaderboard upsert, KV OG prerender
  → GitHub calls go straight through `createRawGitHubClient` (no shared queue)

Queue observability:
GET /api/queue/github
  → read-only snapshot derived from D1 `score_jobs` (queued = lag, running = pending)
  → used by /ops/queue public monitoring page
```

Entrypoints:
- `worker/index.ts` (Workers entry: vinext `fetch` + Queue `queue()` consumer; calls `setEnv(env)`)
- `src/server/env.ts` (bindings adapter: `getEnv()` returns DB / CACHE / SCORE_QUEUE)
- `src/server/api/score-jobs.ts` (async jobs on D1 + Queue, `processScoreJob` consumer)
- `src/server/queue/github-queue-observer.ts` (queue health snapshot from D1)
- `src/server/github/raw-client.ts` (direct GitHub HTTP client)

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
| **Transport** | Direct GitHub HTTP via `raw-client.ts`; concurrency bounded by Queue `max_concurrency` (4) |

### Error handling
- `GitHubNotFoundError` → 404 to client
- `GitHubRateLimitError` → 429 to client, stops enrichment early
- Retries on any 5xx and on network errors (up to 2 retries, exponential backoff); a 429 /
  rate-limit 403 whose reset is within 30s is waited out and retried
- A non-GitHub error during commit enrichment (e.g. Workers "Too many subrequests") fails the
  job with `server_error` instead of caching a score built from partial data
- `getCommit` keeps only `sha`, message, author date, `stats` and file names (no patches)
- Events pagination limit (`422`) is handled gracefully and exposed as a limitation flag

### Job pipeline reliability
- Cloudflare Queue `areyougoingtoslop-score-jobs`: `max_batch_size` 1, `max_concurrency` 4, `max_retries` 2.
- Scoring errors mark the job `failed` (no retry); only D1/infra errors make the consumer retry.
- The consumer claims a job atomically (`UPDATE ... WHERE status = 'queued' ... RETURNING`), so a
  duplicate delivery of a live job is a no-op; a retry delivery may take over its own running row.
- On the last delivery attempt the consumer marks the job `failed` / `server_error` and acks.
- `running` jobs not updated for 15 min (`STALE_MS`), and `queued` jobs older than 6h
  (`QUEUED_STALE_MS`), are reported as `failed` / `server_error` and left out of queue stats.
- Job snapshots live in D1, so polling is consistent across isolates.

### Queue observability snapshot contract

`GET /api/queue/github` returns `health`, `warnings`, `queue` and `consumers`, all derived from
D1 `score_jobs`. Without Cloudflare bindings it reports `enabled: false`, `health: "disabled"`.

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

Workers KV (`CACHE` binding), 12h TTL:

| Key | Value |
|-----|-------|
| `score:v1:<lowercased username>` | JSON `{ value: SlopScoreResult, expiresAt }` |
| `og:v1:<lowercased username>` | prerendered OG PNG |

The commit artifact cache (`repo:sha`) stays in isolate memory (best effort).

---

## 4. Rate Limiting (`src/server/rate-limit/`)

Window counters in D1 `rate_limits`, keyed by `scope:ip` (`x-forwarded-for` or `x-real-ip`).
Each key's window starts at its first request and lasts `windowMs` (one upsert per check).
Fails open if D1 is unavailable.

---

## 5. Leaderboard (`src/server/leaderboard/`)

D1 table `leaderboard` (one row per lowercased username) plus `counters.leaderboard_unique` for
`total_analyzed`.

| Parameter | Value |
|-----------|-------|
| Min update interval | 10 min per user |
| Default query limit | 50 |
| Confidence floor | `medium` (filters out `low` confidence) |
| Sort | Score desc → most recent → username alpha |

---

## 6. Client-Side Visualizations

### 6.1 Slop Heatmap (`src/app/u/[username]/slop-heatmap.tsx`)

A GitHub-style contribution calendar rendered as an inline SVG. It receives the `analyzed_commits` array from the score result and buckets commits by day, coloring each cell by the ratio of flagged commits using the full emerald → amber → warm-red → rose spectrum.

- **Input:** `AnalyzedCommit[]` + `windowDays` (from the scoring window, typically 180).
- **Grid:** Builds a Monday-aligned week grid via `buildGrid()`, then maps each day to a `DayBucket { total, flagged }`.
- **Color ramp:** 5-level scale — near-invisible empty, emerald (clean), amber (≤50%), warm-red (≤80%), rose (>80%). Defined in `globals.css` as `--heatmap-*` custom properties.
- **Filtering:** Client-side time-range filter (6m/3m/1m/1w) dims out-of-range cells without re-fetching data.
- **Insight line:** Computes slop streak, hottest month, and flagged-% to generate a snarky one-liner.
- **Tooltip:** Rich tooltip with green/red ratio bar, flagged count, and sarcastic vibe label.
- **Animation:** Uses `motion/react` (`motion.rect`) for declarative entrance (spring stagger per column), direction-aware filter wave (right-to-left when widening, left-to-right when narrowing), and smooth `fill` transitions on data arrival. CSS `heatmap-cell-pulse` keyframe retained for progressive-data pulse.
- **Responsive:** Uses `ResizeObserver` to auto-size cells to fill the container.

---

## 7. Performance Tracking (`src/server/perf/`)

Rolling buffer of last 200 score request durations. Exposes `getScoreP95()` for monitoring against the <10s target.
