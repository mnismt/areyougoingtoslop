# AGENTS.md — areyougoingslop

Guidelines for coding agents (Codex, Claude Code, etc.) working in this repo.

## Mission
Build **areyougoingslop**: a humorous, transparent heuristic app that scores how AI-assisted a GitHub user's public contributions appear.

## Product Constraints (MVP)
- Public GitHub data only.
- User-level scoring only (no repo-level scoring in MVP).
- Org/private activity excluded.
- Leaderboard is default public.
- Recency decay must be applied in scoring:
  - 0–30d = 1.0
  - 31–90d = 0.6
  - 91–180d = 0.3
  - >180d excluded

## Source of Truth
- PRD: `docs/PRD.md`
- Planning: `docs/roadmap/README.md` + `docs/roadmap/epic-*.md`

## Engineering Rules
- Keep changes scoped to requested task/epic.
- Prefer small, reviewable commits.
- Do not silently change product scope.
- Do not weaken disclaimers around heuristic/satire nature.
- Add/update tests when touching scoring or API contracts.
- Keep output deterministic for scorer unit tests.

## Suggested Structure
- `src/server/github/*` for ingestion
- `src/server/scoring/*` for scoring engine
- `src/app/api/*` for endpoints
- `src/app/u/[username]/*` for result UI

## Definition of Done (per task)
- Build passes
- Lint/typecheck pass
- Tests pass (or new tests added with rationale)
- Docs updated if behavior/contract changed

## Tone Guardrail
Copy should be witty and thoughtful, not mean-spirited. Roast behavior, not people.
