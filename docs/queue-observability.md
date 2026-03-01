# Queue Observability Guide

This guide explains how queue telemetry works, what each metric means, and how to debug mismatches between score-job activity and queue health.

## Why this exists

The app now has a public queue dashboard:

- API: `GET /api/queue/github`
- UI: `/ops/queue`

It is read-only and intentionally safe for public exposure (no request payloads, no tokens, no user-specific queue payload data).

## Incident + fix summary

We hit two real-world issues during local testing:

- Score jobs progressed (`discovering -> enriching -> completed`) while queue snapshots looked idle.
- `/api/queue/github` intermittently returned `500` with `Cannot read properties of undefined (reading 'worker_starts')`.

### Root causes

- Redis-backed telemetry and process-local runtime telemetry can diverge during dev/hot-reload windows.
- A legacy in-memory queue runtime shape (missing `metrics`) could survive reloads, causing runtime metric reads to crash.

### Fixes implemented

- Runtime metrics are now normalized/backfilled on every read so missing fields default to `0` instead of throwing.
- Queue snapshot keeps two debug planes for cross-checking:
  - `client_selection` and `runtime` (process-local behavior)
  - `queue` and `consumers` (Redis-backed infrastructure state)

This gives two independent signals:

- Redis-level state (`queue`, `consumers`) for shared infrastructure truth.
- Process-level state (`client_selection`, `runtime`) for current app-runtime behavior.

## API contract (`GET /api/queue/github`)

Top-level fields:

- `enabled`: whether queue mode is enabled (`REDIS_URL` present).
- `health`: `disabled | ok | degraded`.
- `generated_at`: snapshot timestamp.
- `warnings[]`: non-fatal diagnostics.

### `queue` (Redis-backed)

- `workers_configured`: configured worker concurrency (`GITHUB_QUEUE_WORKERS`, default 4).
- `stream_initialized`: whether worker group exists on the stream.
- `lag`: undispatched entries from stream/group perspective.
- `pending`: entries claimed but not acknowledged.
- `delayed`: retry backlog in delayed zset.
- `active_consumers`: current consumer count observed from Redis group/consumer metadata.
- `processed_entries`: total entries read by the consumer group (`entries-read` when available).
- `next_retry_at`: next delayed retry timestamp (ISO) if present.
- `next_retry_in_ms`: milliseconds until next delayed retry if present.

### `consumers` (Redis-backed)

Per-consumer view from `XINFO CONSUMERS`:

- `name`
- `pending`
- `idle_ms`
- `inactive_ms`

### `client_selection` (process-local)

How `createGitHubClient()` selected transport in this runtime:

- `queued`: queue transport was selected.
- `raw_fetcher`: direct/raw client selected because custom fetcher was supplied.
- `raw_queue_disabled`: direct/raw client selected because queue disabled.
- `last_selected`, `updated_at`: most recent mode/timestamp.

### `runtime` (process-local)

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

## How to interpret metrics together

Use both layers. Each alone can be misleading in dev.

- `client_selection.queued > 0` proves app code path selected queued transport.
- `runtime.enqueued` rising proves this runtime enqueued work.
- `queue.processed_entries` rising proves Redis consumer group processed messages.
- `queue.pending/lag` can spike briefly under burst load and return to 0 quickly.
- `active_consumers` can drop to 0 on idle snapshots; this is not automatically an error.

## Quick debug playbook

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

Expected under normal behavior:

- `client_selection.queued` increases.
- `runtime.enqueued` increases.
- `queue.processed_entries` increases.
- `queue.lag` / `queue.pending` may show transient non-zero values then drain.

## Common mismatch patterns

- `client_selection.queued = 0` and `raw_queue_disabled > 0`
  - Queue mode disabled in app runtime (check `REDIS_URL`).
- `client_selection.queued > 0`, `runtime.enqueued` rising, but `queue.processed_entries` flat
  - Worker/group not processing (check Redis connectivity/group state).
- `queue.processed_entries` rising but score jobs are stuck
  - Investigate result key lifecycle, timeout settings, and request retries.
- `health: degraded`
  - Snapshot read is partial; inspect `warnings[]` for specific failing Redis read.

## Notes for local development

- Process-local counters (`runtime`, `client_selection`) reset on restart and can be impacted by dev server reload behavior.
- Redis-backed counters (`queue`, `consumers`) represent infrastructure state and may include previously-created consumer groups/consumers.
- Score jobs are still process-memory snapshots (30-minute retention); queue observability does not persist score-job state.
- If queue telemetry still looks inconsistent after major code changes, restart `bun dev` to clear stale in-memory runtime state.
