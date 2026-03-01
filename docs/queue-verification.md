# Queue + Job Verification

Use this checklist to verify the Redis-backed GitHub request queue and score-job polling behavior.

## Prerequisites

- App is running on `http://localhost:3000`.
- `REDIS_URL` is set and reachable.
- Optional: `GITHUB_TOKEN` is set to reduce rate-limit noise.

## 1) Start a Job

```bash
curl -s -X POST "http://localhost:3000/api/score/sindresorhus/jobs"
```

Expected:
- Status `202` while running, or `200` if cached completion is returned immediately.
- Body includes `job_id`, `status`, `stage`, `coverage`, and `limits`.

## 2) Poll Job Snapshot

```bash
curl -s "http://localhost:3000/api/score/jobs/<job_id>"
```

Expected progression:
- `status`: `queued|running` -> `completed|failed`
- `stage`: `queued|discovering|enriching|finalizing`
- `progress_percent` increases and ends at `100`

## 3) Verify Missing Job Semantics

```bash
curl -i "http://localhost:3000/api/score/jobs/does-not-exist"
```

Expected:
- HTTP `404`
- JSON body includes `error: "job_not_found"`

Important distinction:
- `job_not_found` means the polling job id is unknown/expired.
- `snapshot.error.code = "not_found"` means the GitHub username itself does not exist.

## 4) Verify Queue Activity in Redis

```bash
redis-cli --raw KEYS "ays:gh:req:*"
```

Expected keys appear during traffic, including stream/delay/result keys:
- `ays:gh:req:stream`
- `ays:gh:req:delayed`
- `ays:gh:req:result:*`

## 5) Quick Troubleshooting

- Repeated `404` polling with a real `job_id` usually means the process restarted or the job aged out.
- Score-job snapshots are in-process memory with a 30-minute retention window.
- In development, duplicate `POST /jobs` calls can happen due to React Strict Mode behavior.
- After hot reloads, if queue telemetry appears stale, restart `bun dev` to reset process-local runtime counters.

## 6) Queue Monitoring Page

```bash
curl -s "http://localhost:3000/api/queue/github"
```

Expected:
- `health`: `ok|degraded|disabled`
- `queue.lag`, `queue.pending`, `queue.delayed` counters are present
- `queue.active_consumers` may spike during active work and return to `0` on idle snapshots
- `client_selection` and `runtime` objects are present for in-process queue diagnostics

UI:
- Open `http://localhost:3000/ops/queue` for the public live dashboard.

## 7) Burst Test (Recommended)

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

If this does not happen, see `docs/queue-observability.md` for mismatch diagnosis.
