# Deployment Checklist

The app runs on Cloudflare Workers via [vinext](https://github.com/cloudflare/vinext)
(Vite reimplementation of Next.js) and `@cloudflare/vite-plugin`. Config lives in `wrangler.jsonc`;
the Worker entry is `worker/index.ts` (vinext `fetch` + Queue `queue()` consumer).

## Bindings (`wrangler.jsonc`)
- `DB` — D1 database `areyougoingtoslop` (schema in `migrations/`): score jobs, leaderboard,
  counters, feedback, rate limits.
- `CACHE` — KV namespace: `score:v1:<user>` and `og:v1:<user>` (12h TTL).
- `SCORE_QUEUE` — Queue producer + consumer on `areyougoingtoslop-score-jobs`
  (`max_batch_size` 1, `max_concurrency` 4, `max_retries` 2).
- `ASSETS` — static assets (required by vinext).

## Environment
- Secrets: `GITHUB_TOKEN`, `OPS_TOKEN` — `bunx wrangler secret put <NAME>`.
  Locally they are read from `.env` or `.dev.vars` (both reach `process.env` under workerd).
- `NEXT_PUBLIC_SITE_URL` — inlined at build time from `.env*`.

## Local development (miniflare / workerd)
- `bun install`
- `bun run db:migrate:local` — applies `migrations/*.sql` to `.wrangler/state` (local only).
- `bun run dev` — `vite dev` on http://localhost:3000; D1, KV and the Queue are all miniflare-local.
- `bun run build && bun run preview` — production bundle under workerd on http://localhost:4173.
- Inspect local state: `bunx wrangler d1 execute DB --local --command "SELECT * FROM score_jobs"`,
  `bunx wrangler kv key list --binding CACHE --local`.

## First deploy
1. `bunx wrangler d1 create areyougoingtoslop` → paste `database_id` into `wrangler.jsonc`.
2. `bunx wrangler kv namespace create CACHE` → paste `id` into `wrangler.jsonc`.
3. `bunx wrangler queues create areyougoingtoslop-score-jobs`.
4. `bunx wrangler secret put GITHUB_TOKEN` and `bunx wrangler secret put OPS_TOKEN`.
5. `bun run db:migrate:remote`.
6. Optional leaderboard import from the old Redis deployment:
   `redis-cli --raw GET ays:leaderboard:v1:state > lb.json`,
   `bun run scripts/leaderboard-json-to-sql.ts lb.json <uniqueCount> > lb.sql`,
   `bunx wrangler d1 execute DB --remote --file lb.sql`.
7. `bun run deploy` (`vite build && wrangler deploy`).

Plan note: a scoring job with a token can make ~560 GitHub subrequests and the bundle includes the
`@vercel/og` wasm, so Workers Paid is required. miniflare does not enforce these limits.

## Build gate
- `bun run typecheck`, `bun run test`, `bun run lint`, `bun run build`.

## Smoke Verification (Local or Prod)
- Start job: `curl -s -X POST "http://localhost:3000/api/score/<username>/jobs"`
- Poll job: `curl -s "http://localhost:3000/api/score/jobs/<job_id>"` — `queued/running` → terminal.
- Missing job: `curl -i "http://localhost:3000/api/score/jobs/does-not-exist"` → `404` `job_not_found`.
- Queue snapshot: `curl -s -H "authorization: Bearer $OPS_TOKEN" "http://localhost:3000/api/queue/github"`
  → `cache-control: no-store`.
- `/ops/queue` renders live queue metrics; `/api/og/<username>` renders a card image.
- Burst check: start 4-8 parallel `/api/score/<username>/jobs` requests and confirm `queue.lag` +
  `queue.pending` rise, `consumers` stays ≤ 4, then drains.
