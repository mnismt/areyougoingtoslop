# Deployment Checklist (MVP)

## Environment
- `GITHUB_TOKEN` set for GitHub API calls.
- `REDIS_URL` set for centralized GitHub request queue.
- `NEXT_PUBLIC_SITE_URL` set to production origin.
- `LEADERBOARD_STORAGE_PATH` set to persistent storage path.

Optional:
- `FEEDBACK_STORAGE_PATH` for feedback persistence.
- Queue tuning knobs (only if needed): `GITHUB_QUEUE_WORKERS`, `GITHUB_QUEUE_MAX_ATTEMPTS`, `GITHUB_QUEUE_REQUEST_TIMEOUT_MS`.

## Build
- Run `bun run build`, `bun run typecheck`, and `bun run test`.
- Run `bun run lint` (note: existing unrelated lint debt may need cleanup).
- Verify `/api/score/[username]` returns expected payload.
- Verify `/api/score/[username]/jobs` returns a snapshot.
- Verify `/api/score/jobs/[jobId]` progresses from `queued/running` to terminal state.
- Verify unknown job ids return `404` with `error: "job_not_found"`.
- Verify `/api/queue/github` returns queue health with `cache-control: no-store`.
- Verify `/api/queue/github` includes `client_selection` and `runtime` diagnostics.
- Verify `/ops/queue` renders live queue metrics.
- Confirm `/api/og/[username]` renders a card image.

## Launch
- Deploy on a Node-compatible runtime (Next.js App Router).
- Keep at least one long-lived Node process (`next start`) so embedded queue workers stay active.
- Confirm leaderboard persists between restarts.
- Confirm Redis is reachable and queue keys are created under `ays:gh:req:*`.
- Monitor logs for `score_request` timing and p95.
- Monitor queue health: retry spikes, reclaim activity, and sustained backlog.

## Smoke Verification (Local or Prod)
- Start job: `curl -s -X POST "http://localhost:3000/api/score/<username>/jobs"`
- Poll job: `curl -s "http://localhost:3000/api/score/jobs/<job_id>"`
- Missing job behavior: `curl -i "http://localhost:3000/api/score/jobs/does-not-exist"`
- Queue snapshot: `curl -s "http://localhost:3000/api/queue/github"`
- Queue activity check (optional): `redis-cli --raw KEYS "ays:gh:req:*"`
- Burst check (recommended): start 4-8 parallel `/api/score/<username>/jobs` requests and confirm `client_selection.queued`, `runtime.enqueued`, and `queue.processed_entries` rise.
