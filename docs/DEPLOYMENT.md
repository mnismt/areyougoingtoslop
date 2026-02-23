# Deployment Checklist (MVP)

## Environment
- `GITHUB_TOKEN` set for GitHub API calls.
- `NEXT_PUBLIC_SITE_URL` set to production origin.
- `LEADERBOARD_STORAGE_PATH` set to persistent storage path.

## Build
- Run `npm run build` and `npm run lint`.
- Verify `/api/score/[username]` returns expected payload.
- Confirm `/api/og/[username]` renders a card image.

## Launch
- Deploy on a Node-compatible runtime (Next.js App Router).
- Confirm leaderboard persists between restarts.
- Monitor logs for `score_request` timing and p95.
