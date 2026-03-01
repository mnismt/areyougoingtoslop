# Epic 11 — Coverage-First Ingestion + Streaming UX

## Goal
Maximize the number of public commits we can analyze for a user while keeping the product fast, transparent, and smooth through progressive loading and streaming updates.

## Why this Epic Exists
The current synchronous scoring flow is accurate for small/medium users but misses coverage and creates long waits for heavy contributors.

Known constraints today:
- GitHub Events API is capped and can return pagination limit errors for very active users.
- PushEvent payloads can omit `payload.commits`, forcing fallback to `payload.head` and follow-up commit fetches.
- Event retention is short and inconsistent with a 180-day scoring window.
- Unauthenticated mode is heavily rate-limited.
- Commit stat enrichment is the primary latency bottleneck.

This epic turns the scorer into a coverage-first pipeline with incremental UX.

## Product Principles
- **Coverage-first:** prefer broad commit discovery over narrow event-only heuristics.
- **Fast first paint:** return usable UI immediately, then improve completeness live.
- **Transparent confidence:** expose data coverage and known blind spots to users.
- **Deterministic scoring:** keep stable outputs for unit/integration tests.
- **Satirical but fair:** preserve disclaimer language and avoid overclaiming certainty.

## Success Metrics
- p95 time to first useful result (partial score + basic signals): **< 2.5s** on warm paths.
- p95 time to completed analysis for typical users: **< 10s**.
- Increase median analyzed commits per scored user by **3-5x** relative to event-only baseline.
- Surface `coverage` metadata in **100%** of responses.
- API error budget for score jobs (5xx): **< 1%** over rolling 7 days.

## Scope
- Hybrid commit discovery (Events + repository commit listing + optional GraphQL contribution discovery + optional commit search fallback).
- Async scoring jobs with in-flight dedupe and resumable status.
- Progressive/streaming API for job updates.
- Frontend skeleton + staged rendering + live progress UI.
- Multi-layer caching for score snapshots and commit enrichment artifacts.
- Coverage and limitation telemetry in API and UI.

## Out of Scope
- Private repository analysis.
- Organization-internal or enterprise-only activity analysis.
- Realtime webhook ingestion platform.
- Major scoring-signal redesign (weights and satire logic stay mostly intact).

## High-Level Design

### 1) Ingestion and Discovery (Coverage)
- Keep Events API as a **seed** source for recent activity and repository hints.
- Add repository-level discovery to enumerate commits by author within the scoring window.
- Use optional GraphQL contribution data (when token exists) to discover additional active repositories faster.
- Use optional commit search as targeted fallback when repository enumeration is incomplete.
- Deduplicate globally by `repo + sha` before enrichment.

### 2) Enrichment (Depth)
- Enrich discovered commits with per-commit stats and metadata.
- Prioritize newest commits first for early UX value.
- Use adaptive concurrency to avoid secondary rate limits.
- Persist commit-level enrichment cache by immutable key (`repo:sha`) to avoid refetching.

### 3) Scoring (Deterministic)
- Score partial data continuously as enrichment progresses.
- Emit `partial` snapshots until terminal state.
- Keep deterministic ordering and stable rounding to preserve test behavior.

### 4) Delivery (UX)
- Return initial shell immediately.
- Stream progress and partial score snapshots via SSE.
- Finalize into cached terminal snapshot used by normal score endpoint.

## Proposed API Additions

### `POST /api/score/[username]/jobs`
Create or attach to an in-flight job.

Response (example):
```json
{
  "job_id": "job_abc123",
  "username": "octocat",
  "status": "queued",
  "created_at": "2026-02-28T12:00:00.000Z"
}
```

### `GET /api/score/jobs/[job_id]`
Return current snapshot (poll fallback when SSE unavailable).

Response (example):
```json
{
  "job_id": "job_abc123",
  "username": "octocat",
  "status": "running",
  "stage": "enriching",
  "progress_percent": 61,
  "coverage": {
    "commits_discovered": 248,
    "commits_enriched": 151,
    "repos_scanned": 17,
    "repos_total": 22,
    "window_days": 180,
    "is_partial": true,
    "sources_used": ["events", "repo_commits"]
  },
  "result": {
    "slop_score": 44,
    "tier": "The LLM Diplomat",
    "confidence": "medium",
    "top_signals": ["Suspicious velocity spikes"],
    "scoring_window": "last 180 days",
    "analyzed_commits": []
  },
  "limits": {
    "rate_limited": false,
    "events_pagination_limited": true
  },
  "updated_at": "2026-02-28T12:00:05.000Z"
}
```

### `GET /api/score/jobs/[job_id]/stream`
SSE stream for low-latency updates.

Event types:
- `job_status`
- `job_progress`
- `score_snapshot`
- `job_warning`
- `job_complete`
- `job_error`

## Data Model Additions
- `ScoreJob`: lifecycle state, timing, username, retry metadata.
- `ScoreCoverage`: discovered/enriched counts, sources, partial flags.
- `ScoreLimits`: rate-limit and source-limitation indicators.
- `CommitArtifactCache`: immutable commit enrichment blobs keyed by `repo:sha`.

## Frontend UX Requirements
- Before first snapshot: brief "Starting investigation..." placeholder.
- **Investigation view** (`InvestigationView` component) replaces skeleton loading:
  - **Progress header:** stage label + percentage badge + thin progress bar with smooth transitions.
  - **Detection protocol:** 5 signal-check steps that light up progressively as stages advance (pending → scanning → clear).
  - **Live stats footer:** commits enriched/discovered, repos scanned/total, window, intel sources — updating in real-time.
  - **Warnings:** partial snapshot, rate-limit, and pagination-limit messages shown inline.
- On completion, investigation view is replaced by:
  - Score card (avatar, tier, gauge, confidence badge, verdict line, share actions).
  - Stats strip (4-column grid: commits inspected, repos raided, crime window, intel sources).
  - Signal breakdown cards (top signals with score-colored left border).
  - Analyzed commits list (20/page, flagged-only filter).
- Preserve satirical disclaimer and confidence verdict line in final state.

## Workstreams and Tasks

### A) Pipeline Core
- [x] Introduce async score-job orchestrator with explicit stage transitions.
- [x] Add in-flight dedupe per username (single active job + shared listeners).
- [x] Add cancellation/expiry for stale jobs.

### B) Discovery Expansion
- [x] Keep Events API seed ingestion with current graceful 422 handling.
- [x] Add repository commit enumeration by `author + since/until` for discovered repos.
- [ ] Add optional GraphQL contribution-based repository discovery when token is present.
- [ ] Add optional commit-search fallback for high-activity edge cases.
- [x] Add global dedupe and deterministic sort (`occurredAt desc`, stable SHA tiebreak).

### C) Enrichment Performance
- [x] Add commit artifact cache (`repo:sha`) with TTL and storage policy.
- [ ] Add adaptive enrichment concurrency with backoff on secondary-limit signals.
- [x] Prioritize newest commits and signal-rich candidates first.

### D) API Surface
- [x] Add `POST /api/score/[username]/jobs`.
- [x] Add `GET /api/score/jobs/[job_id]`.
- [ ] Add `GET /api/score/jobs/[job_id]/stream` (SSE).
- [x] Keep existing `GET /api/score/[username]` as latest completed snapshot.
- [x] Include `coverage`, `limits`, `status`, and `is_partial` fields in job score payloads.

### E) UI/UX Streaming
- [x] Add client-side score job hook (start + fallback poll).
- [x] Upgrade result page to investigation view with detection protocol + live stats (replaced skeleton loading).
- [x] Add coverage and limitation messaging in UI.
- [x] Ensure mobile-first layout for investigation view + commit list.
- [x] Add client-side commit list pagination (20/page) with flagged-only filter toggle.
- [x] Personality overhaul: rewrote stage labels, error states, share actions, flag labels, signal copy.

### F) Caching and Reliability
- [ ] Keep 12h score cache and add stale-while-revalidate behavior.
- [ ] Persist commit artifacts beyond process memory (file/Redis strategy decision).
- [ ] Add queue guardrails (global concurrency + per-user fairness).

### G) Observability
- [ ] Track per-stage durations and publish p50/p95 metrics.
- [ ] Log source utilization and limitation triggers.
- [ ] Add counters for discovered vs enriched commit coverage.

### H) Testing
- [x] Unit tests for job state machine and deterministic partial scoring.
- [x] Ingestion tests for fallback ordering and dedupe.
- [ ] API tests for job lifecycle + SSE formatting.
- [ ] UI tests for streaming states and skeleton transitions.

### I) Documentation
- [x] Update `docs/ARCHITECTURE.md` request flow with job + streaming path.
- [x] Update `docs/PRD.md` performance and UX sections with partial-result model.
- [x] Update deployment docs with required env vars and cache notes.

## Dependencies
- Epic 02 (Ingestion) foundations available.
- Epic 04 (API Surface) existing score contract and error conventions.
- Epic 05 (Core UI) result route and loading state baseline.
- Epic 09 (Performance & Reliability) existing cache/rate-limit scaffolding.

## Risks and Mitigations
- **Risk:** Secondary rate limits from aggressive enrichment.
  - **Mitigation:** adaptive concurrency, jittered retries, shared queue budget.
- **Risk:** Incomplete coverage still possible for very active users.
  - **Mitigation:** expose coverage metrics + limitation flags; never imply exhaustive certainty.
- **Risk:** SSE reliability in some hosting environments.
  - **Mitigation:** poll fallback via `GET /jobs/[id]`.
- **Risk:** Increased backend complexity.
  - **Mitigation:** strict stage machine, test coverage, and phased rollout.

## Rollout Plan (Two-Phase)
- **Phase 1 — Fast Path (Ship Quickly):**
  - async job pipeline + in-flight dedupe + polling endpoint
  - Events seed + repository commit enumeration (`author + since/until`)
  - deterministic global dedupe/sort + partial scoring snapshots
  - staged skeleton UI and progressive rendering (poll-based)
  - in-memory artifact cache + current 12h score cache
  - outcome: fast first result and meaningful coverage lift with low implementation risk
- **Phase 2 — Full Coverage Path (Max Coverage):**
  - SSE stream endpoint and client reconnect handling
  - optional GraphQL contribution repository discovery
  - optional commit-search fallback for high-activity edge cases
  - persistent commit artifact cache (file/Redis strategy)
  - adaptive concurrency/backoff tuned with production telemetry
  - richer coverage/limits reporting in API + UI
  - outcome: highest practical public coverage with smoother live UX at scale

## Definition of Done
- System returns partial results quickly and converges to final score without blocking full page render.
- Commit coverage is materially higher than baseline and measurable in telemetry.
- Existing endpoint compatibility is preserved.
- New contracts are test-covered (unit + API + UI integration where applicable).
- Disclaimers remain explicit: satirical heuristic, not factual proof.
