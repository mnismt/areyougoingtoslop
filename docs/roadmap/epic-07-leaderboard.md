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
- [ ] Define leaderboard data model
- [ ] Add persistence for recent scored users
- [ ] Rank by slop score (with confidence floor)
- [ ] Build `/leaderboard` page
- [ ] Show last-updated timestamp per user
- [ ] Add abuse guardrails (basic spam protection)

## Dependencies
- Epic 04 API and Epic 05 result flow.

## Definition of Done
- Leaderboard updates and displays stable public rankings.

## Open Questions
- Should there be a hide/removal request flow post-MVP?
