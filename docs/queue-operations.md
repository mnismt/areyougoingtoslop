# Queue Operations

Score-job pipeline on Cloudflare (D1 `score_jobs` + Queue `ays-score-jobs`): verification, observability, and debugging.

## Prerequisites

- `bun run db:migrate:local`, then `bun run dev` (or `bun run build && bun run preview` on :4173). D1, KV and the Queue run in miniflare.
- `GITHUB_TOKEN` and `OPS_TOKEN` in `.env` or `.dev.vars` (both gitignored).

---

## Verification Checklist

### 1) Start a Job

```bash
curl -s -X POST "http://localhost:3000/api/score/sindresorhus/jobs"
```

Expected:
- Status `202` while queued/running (a second POST for the same user returns the same `job_id`), or `200` if cached completion is returned immediately.
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

### 4) Verify Queue and Storage Activity

The dev/preview log prints one line per consumer batch:

```
QUEUE ays-score-jobs 1/1 (5339ms)
```

Inspect local state (shared with the running server):

```bash
bunx wrangler d1 execute DB --local --command "SELECT username_key,status,updated_at FROM score_jobs ORDER BY updated_at DESC LIMIT 20" --json
bunx wrangler d1 execute DB --local --command "SELECT username,slop_score FROM leaderboard" --json
bunx wrangler kv key list --binding CACHE --local   # score:v1:<user>, og:v1:<user>
```

Production: drop `--local` for `--remote`, and watch `bunx wrangler tail`.

### 5) Check Health Endpoint

```bash
curl -s -H "authorization: Bearer $OPS_TOKEN" "http://localhost:3000/api/queue/github"
```

- `401` without a valid bearer token. `200` with `cache-control: no-store` otherwise.
- `/ops/queue/snapshot` serves the same JSON to the `/ops/queue` page.

---

## Health Snapshot Fields

Everything is derived from one D1 query over `score_jobs` (active rows plus terminal rows from the last 30 minutes). There is no Redis and no process-local state, so every isolate reports the same numbers.

- `enabled`: `false` when the Cloudflare bindings are unavailable (`health: "disabled"`).
- `health`: `ok`, `disabled`, or `degraded` (the D1 read failed; see `warnings[]`).

#### `queue`

- `workers_configured`: `4`, the consumer's `max_concurrency` in `wrangler.jsonc`.
- `stream_initialized`: always `true`.
- `lag`: jobs with status `queued`.
- `pending`: jobs with status `running`.
- `known_consumers`, `online_consumers`, `active_consumers`: all equal the running-job count.
- `delayed`: always `0`. `next_retry_at` / `next_retry_in_ms`: always `null`.
- `processed_entries`: completed + failed jobs in the retention window.

#### `consumers`

One entry per running job: `name` (`job-<first 8 chars of job_id>`), `pending: 1`, `idle_ms` since its last progress write, `inactive_ms: null`, `current_usernames`.

#### Usernames

- `active_score_usernames`: queued and running usernames.
- `recent_usernames`: last 10 distinct completed usernames.

`client_selection` and `runtime` are gone. They were process-local Redis transport counters and mean nothing across Worker isolates.

---

## Failure Signatures

- Job stays `queued`, log shows no `QUEUE` line: the consumer is not running. Check the `queues.consumers` block in `wrangler.jsonc` and that the queue exists (`bunx wrangler queues list`).
- Job reads `failed` with `server_error`: either the consumer's last delivery attempt failed (it marks the job failed), a `running` job made no progress for 15 minutes (`STALE_MS`, the consumer died), or a `queued` job waited over 6 hours (`QUEUED_STALE_MS`). Waiting in a normal backlog does not fail a job. The next POST for that user replaces the stale row; stale rows are left out of `lag` / `pending` / `consumers`.
- `score_job_failed` in the log: an unexpected scoring error, with its stack. Typical GitHub causes surface as job errors instead (`not_found`, `rate_limited`).
- `score_job_infra_error` in the log: a D1 write failed inside the consumer; the message is retried (`max_retries: 2`, 30s delay).
- `health: "degraded"`: the snapshot query failed; inspect `warnings[]`.

## Known Limits

- Local miniflare dispatches queue batches one at a time, so `consumers` stays at 1 locally. Production honours `max_concurrency: 4`.
- A job can make roughly 560 GitHub subrequests with a token. That needs the Workers Paid plan; miniflare does not enforce subrequest limits.
- There is no shared GitHub backoff across jobs. A rate-limited job fails with `rate_limited`.
