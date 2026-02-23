# Epic 04 — API Surface

## Goal
Expose scoring via stable, documented endpoints.

## Scope
- Score endpoint
- Validation, error contracts, and API tests

## Out of Scope
- Leaderboard and OG-specific endpoints (unless needed)

## Tasks
- [ ] Implement `GET /api/score/:username`
- [ ] Return output contract:
  - [ ] `slop_score`
  - [ ] `tier`
  - [ ] `confidence`
  - [ ] `top_signals[]`
  - [ ] `scoring_window`
- [ ] Add request validation + error handling
- [ ] Add API-level tests (happy path + edge cases)

## Dependencies
- Epic 02 and Epic 03 complete enough for integration.

## Definition of Done
- Endpoint is stable, typed, and test-covered.
- Error states are clear and user-safe.
