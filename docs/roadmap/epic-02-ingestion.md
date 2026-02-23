# Epic 02 — GitHub Data Ingestion Layer

## Goal
Reliably fetch and normalize public user activity from GitHub.

## Scope
- GitHub API client and auth token usage
- Username validation + existence checks
- Data normalization into internal schema

## Out of Scope
- Scoring logic and UI rendering

## Tasks
- [ ] Decide API strategy (REST, GraphQL, or hybrid)
- [ ] Implement GitHub client with auth token support
- [ ] Build username validation + existence check
- [ ] Fetch recent public activity within last 180 days
- [ ] Normalize activity into internal schema (`ContributionEvent`)
- [ ] Handle rate limits (retry + backoff + fail messaging)
- [ ] Add ingestion-level tests with fixture responses

## Dependencies
- Epic 01 baseline scripts and env config.

## Definition of Done
- `fetchUserActivity(username)` returns stable normalized payload for scorer.
- Rate limit/error states are handled and test-covered.
