# Epic 09 — Performance & Reliability

## Goal
Keep the app fast under real usage and resilient to API limits.

## Scope
- Caching strategy
- Logging/telemetry
- Basic throttling
- Performance profiling

## Out of Scope
- Advanced distributed systems optimization

## Tasks
- [x] Add cache strategy (in-memory or Redis)
- [x] Define cache TTL (start with 12h, tune later)
- [x] Add server-side logging/telemetry
- [x] Add request throttling/IP rate limit
- [x] Benchmark p95 response time and optimize bottlenecks

## Dependencies
- Score API and ingestion behavior stabilized.

## Definition of Done
- p95 score response time is under 10s for common lookups.
