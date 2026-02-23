# Epic 07 — Leaderboard (Default Public)

## Goal
Create public discovery surface for top slop scores.

## Scope
- Ranking model and persistence
- Public leaderboard UI
- Basic abuse protection

## Out of Scope
- Private/opt-in modes for MVP

## Tasks
- [x] Define leaderboard data model
- [x] Add persistence for recent scored users
- [x] Rank by slop score (with confidence floor)
- [x] Build `/leaderboard` page
- [x] Show last-updated timestamp per user
- [x] Add abuse guardrails (basic spam protection)

## Dependencies
- Epic 04 API and Epic 05 result flow.

## Definition of Done
- Leaderboard updates and displays stable public rankings.

## Open Questions
- Should there be a hide/removal request flow post-MVP?
