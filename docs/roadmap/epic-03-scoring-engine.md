# Epic 03 — Slop Scoring Engine v1

## Goal
Convert normalized activity into score, tier, confidence, and reasons.

## Scope
- Signal definitions and weighting
- Recency decay model
- Deterministic scoring outputs

## Out of Scope
- Frontend rendering and copy polish

## Tasks
- [ ] Define signal schema + per-signal weight config
- [ ] Implement signal: commit-message AI keywords
- [ ] Implement signal: prompt-crumb patterns
- [ ] Implement signal: velocity vs volume
- [ ] Implement signal: apathy ratio
- [ ] Implement signal: churn/rewrite behavior
- [ ] Implement recency decay bucket weights
  - [ ] 0–30d = 1.0
  - [ ] 31–90d = 0.6
  - [ ] 91–180d = 0.3
- [ ] Aggregate weighted signal score to 0–100
- [ ] Map score to tier label
- [ ] Compute confidence from data completeness + signal consistency
- [ ] Add deterministic unit tests for scoring rules

## Dependencies
- Epic 02 normalized contribution events.

## Definition of Done
- `computeSlopScore(events)` returns `{ score, tier, confidence, reasons }`.
- Signal weights are configurable without code surgery.

## Open Questions
- Minimum contribution threshold before issuing a score?
