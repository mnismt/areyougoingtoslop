# AGENTS.md — areyougoingtoslop

A humorous heuristic app that scores how AI-assisted a GitHub user's public contributions appear.

## Key References

Start with `docs/README.md` for a full index. Key docs by concern:

### Product & Planning
- **PRD:** `docs/PRD.md` — product requirements and MVP scope
- **Roadmap:** `docs/roadmap/README.md` + `docs/roadmap/epic-*.md` — epics & task lists
- **Design:** `docs/DESIGN.md` — UI/UX guidelines, monochrome-luxe aesthetic, tone

### Engineering
- **Architecture:** `docs/ARCHITECTURE.md` — ingestion → scoring → caching → leaderboard
- **Conventions:** `docs/CONVENTIONS.md` — structure, naming, scripts, Definition of Done
- **Testing:** `docs/TESTING.md` — test strategy, commands (`bun test`), writing new tests
- **Deployment:** `docs/DEPLOYMENT.md` — env vars, deployment checklist

### Operations
- **Queue operations:** `docs/queue-operations.md` — verification, observability, and debugging

### Calibration
- `docs/calibration/README.md` + `calibration-samples.json` — reference profiles for scoring sanity-checks

## Rules

1. Use **bun** exclusively — never npm/yarn/pnpm.
2. Keep changes scoped to the requested task/epic.
3. Add/update tests when touching scoring logic or API contracts.
4. Keep scorer output deterministic for unit tests.
5. Never weaken disclaimers — this is satire, not a factual detector.
6. Files use **kebab-case**; Next.js special files are exempt.
7. Tone: witty and thoughtful, never mean-spirited. Roast behavior, not people.
