# Queue Operations

Redis-backed GitHub request queue: verification, observability, and debugging.

## Prerequisites

- App is running on `http://localhost:3000`.
- `REDIS_URL` is set and reachable.
- Optional: `GITHUB_TOKEN` is set to reduce rate-limit noise.

---

## Verification Checklist

### 1) Start a Job

```bash
curl -s -X POST "http://localhost:3000/api/score/sindresorhus/jobs"
```

Expected:
- Status `202` while running, or `200` if cached completion is returned immediately.
- Body includes `job_id`, `status`, `stage`, `coverage`, and `limits`.

### 2) Poll Job Snapshot

```bash
curl -s "http://localhost:3000/api/score/jobs/<job_id>"
```

Expected progression:
- `status`: `queued|running` -> `completed|failed`
- `stage`: `queued|discovering|enriching|finalizing`
- `progress_percent` increases and ends at `100`

### 3) Verify Missing Job Semantics

```bash
curl -i "http://localhost:3000/api/score/jobs/does-not-exist"
```

Expected:
- HTTP `404`
- JSON body includes `error: "job_not_found"`

Important distinction:
- `job_not_found` means the polling job id is unknown/expired.
- `snapshot.error.code = "not_found"` means the GitHub username itself does not exist.

### 4) Verify Queue Activity in Redis

```bash
redis-cli --raw KEYS "ays:gh:req:*"
```

Expected keys appear during traffic, including stream/delay/result keys:
- `ays:gh:req:stream`
- `ays:gh:req:delayed`
- `ays:gh:req:result:*`

### 5) Queue Monitoring Page

```bash
curl -s "http://localhost:3000/api/queue/github"
```

Expected:
- `health`: `ok|degraded|disabled`
- `queue.lag`, `queue.pending`, `queue.delayed` counters are present
- `queue.online_consumers` may spike during active work and return to `0` on idle snapshots
- `client_selection` and `runtime` objects are present for in-process queue diagnostics

UI:
- Open `http://localhost:3000/ops/queue` for the public live dashboard.

### 6) Burst Test (Recommended)

Start multiple usernames in parallel to force queue traffic:

```bash
for u in torvalds gaearon yyx990803 sindresorhus octocat defunkt; do
  curl -s -X POST "http://localhost:3000/api/score/$u/jobs" >/dev/null &
done
wait
```

Then poll queue snapshot a few times:

```bash
for i in 1 2 3 4 5 6; do
  curl -s "http://localhost:3000/api/queue/github"
  sleep 1
done
```

Expected under load:
- `client_selection.queued` increases.
- `runtime.enqueued` increases.
- `queue.processed_entries` increases.
- `queue.pending` / `queue.lag` may briefly rise and then return to `0` after drain.

---

## Observability

The app exposes a public, read-only queue dashboard (no request payloads, no tokens, no user-specific data):

- API: `GET /api/queue/github`
- UI: `/ops/queue`

### API Contract (`GET /api/queue/github`)

Top-level fields:

- `enabled`: whether queue mode is enabled (`REDIS_URL` present).
- `health`: `disabled | ok | degraded`.
- `generated_at`: snapshot timestamp.
- `warnings[]`: non-fatal diagnostics.

#### `queue` (Redis-backed)

- `workers_configured`: configured worker concurrency (`GITHUB_QUEUE_WORKERS`, default 4).
- `stream_initialized`: whether worker group exists on the stream.
- `lag`: undispatched entries from stream/group perspective.
- `pending`: entries claimed but not acknowledged.
- `delayed`: retry backlog in delayed zset.
- `known_consumers`: total consumers recorded in Redis stream-group metadata.
- `online_consumers`: consumers considered online recently (`idle_ms <= 60s`).
- `active_consumers`: backward-compatible alias of `online_consumers`.
- `processed_entries`: total entries read by the consumer group (`entries-read` when available).
- `next_retry_at`: next delayed retry timestamp (ISO) if present.
- `next_retry_in_ms`: milliseconds until next delayed retry if present.

#### `consumers` (Redis-backed)

Per-consumer view from `XINFO CONSUMERS`:

- `name`
- `pending`
- `idle_ms`
- `inactive_ms`

#### `client_selection` (process-local)

How `createGitHubClient()` selected transport in this runtime:

- `queued`: queue transport was selected.
- `raw_fetcher`: direct/raw client selected because custom fetcher was supplied.
- `raw_queue_disabled`: direct/raw client selected because queue disabled.
- `last_selected`, `updated_at`: most recent mode/timestamp.

#### `runtime` (process-local)

Queue runtime counters in current process:

- `started`: worker runtime marked as started.
- `has_command_client`: command Redis client exists.
- `worker_starts`: number of worker-loop starts in this process lifecycle.
- `enqueued`: number of requests enqueued.
- `worker_processed`: number of stream messages processed by worker loops.
- `responses_stored`: number of queue responses written to Redis result keys.
- `responses_consumed`: number of queue responses consumed by waiting callers.
- `retries_scheduled`: number of retries scheduled to delayed zset.
- `timeouts`: request waits that hit queue timeout.

### Interpreting Metrics

Use both layers. Each alone can be misleading in dev.

- `client_selection.queued > 0` proves app code path selected queued transport.
- `runtime.enqueued` rising proves this runtime enqueued work.
- `queue.processed_entries` rising proves Redis consumer group processed messages.
- `queue.pending/lag` can spike briefly under burst load and return to 0 quickly.
- `online_consumers` can drop to 0 on idle snapshots; this is not automatically an error.
- `known_consumers` can exceed `workers_configured` if stale Redis consumer metadata exists.

---

## Debugging

### Quick Debug Playbook

1) Capture baseline snapshot.

```bash
curl -s "http://localhost:3000/api/queue/github"
```

2) Trigger burst load with different usernames.

```bash
for u in torvalds gaearon yyx990803 sindresorhus octocat defunkt; do
  curl -s -X POST "http://localhost:3000/api/score/$u/jobs" >/dev/null &
done
wait
```

3) Poll queue snapshot for ~5-10 seconds.

```bash
for i in 1 2 3 4 5 6; do
  curl -s "http://localhost:3000/api/queue/github"
  sleep 1
done
```

### Common Mismatch Patterns

- `client_selection.queued = 0` and `raw_queue_disabled > 0`
  - Queue mode disabled in app runtime (check `REDIS_URL`).
- `client_selection.queued > 0`, `runtime.enqueued` rising, but `queue.processed_entries` flat
  - Worker/group not processing (check Redis connectivity/group state).
- `queue.processed_entries` rising but score jobs are stuck
  - Investigate result key lifecycle, timeout settings, and request retries.
- `health: degraded`
  - Snapshot read is partial; inspect `warnings[]` for specific failing Redis read.

### Known Issues & Fixes

We hit two real-world issues during local testing:

- Score jobs progressed (`discovering -> enriching -> completed`) while queue snapshots looked idle.
- `/api/queue/github` intermittently returned `500` with `Cannot read properties of undefined (reading 'worker_starts')`.

**Root causes:**
- Redis-backed telemetry and process-local runtime telemetry can diverge during dev/hot-reload windows.
- A legacy in-memory queue runtime shape (missing `metrics`) could survive reloads, causing runtime metric reads to crash.

**Fixes implemented:**
- Runtime metrics are now normalized/backfilled on every read so missing fields default to `0` instead of throwing.
- Queue snapshot keeps two debug planes for cross-checking:
  - `client_selection` and `runtime` (process-local behavior)
  - `queue` and `consumers` (Redis-backed infrastructure state)

### Quick Troubleshooting

- Repeated `404` polling with a real `job_id` usually means the process restarted or the job aged out.
- Score-job snapshots are in-process memory with a 30-minute retention window.
- In development, duplicate `POST /jobs` calls can happen due to React Strict Mode behavior.
- Process-local counters (`runtime`, `client_selection`) reset on restart and can be impacted by dev server reload behavior.
- Redis-backed counters (`queue`, `consumers`) represent infrastructure state and may include previously-created consumer groups/consumers.
- If queue telemetry looks inconsistent after major code changes, restart `bun dev` to clear stale in-memory runtime state.
