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
