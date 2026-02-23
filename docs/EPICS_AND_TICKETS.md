# areyougoingslop — Epics → Tasks (MVP Breakdown)

> Note: Active planning has been split into per-epic files in `docs/roadmap/`.
> This file is kept as a consolidated snapshot.


## Planning Notes
- Scope locked to **user-level scoring only** for MVP.
- Analyze **public GitHub data only**.
- Include **recency decay** in scoring logic.
- Leaderboard is **default public**.

---

## Epic 1 — Foundation & Repo Hygiene
**Goal:** Prepare stable dev baseline and project conventions.

### Tasks
- [x] Initialize Next.js app (App Router + TS + Tailwind)
- [ ] Add project scripts: `lint`, `typecheck`, `test`, `format`
- [ ] Set up formatter/lint rules (Prettier optional)
- [ ] Create `.env.example` with required variables
- [ ] Add `docs/` structure and index readme
- [ ] Define folder conventions (`src/lib`, `src/server`, `src/features`)

### Deliverables
- Reproducible local setup
- Clean baseline CI-ready structure

---

## Epic 2 — GitHub Data Ingestion Layer
**Goal:** Reliably fetch and normalize public user activity.

### Tasks
- [ ] Decide API strategy (REST, GraphQL, or hybrid)
- [ ] Implement GitHub client with auth token support
- [ ] Build username validation + existence check
- [ ] Fetch recent public commits/activity within last 180 days
- [ ] Normalize activity into internal schema (`ContributionEvent`)
- [ ] Handle rate limits (retry + backoff + fail messaging)
- [ ] Add ingestion-level tests with fixture responses

### Deliverables
- `fetchUserActivity(username)` server module
- Stable normalized event payload for scorer

---

## Epic 3 — Slop Scoring Engine v1
**Goal:** Convert normalized activity into score/tier/confidence.

### Tasks
- [ ] Define signal schema + per-signal weight config
- [ ] Implement signal: commit-message AI keywords
- [ ] Implement signal: prompt-crumb patterns
- [ ] Implement signal: velocity vs volume
- [ ] Implement signal: apathy ratio
- [ ] Implement signal: churn/rewrite behavior
- [ ] Implement **recency decay** bucket weights:
  - [ ] 0–30d = 1.0
  - [ ] 31–90d = 0.6
  - [ ] 91–180d = 0.3
- [ ] Aggregate weighted signal score to 0–100
- [ ] Map score to tier label
- [ ] Compute confidence from data completeness + signal consistency
- [ ] Add deterministic unit tests for all scoring rules

### Deliverables
- `computeSlopScore(events) => {score, tier, confidence, reasons}`
- Tested and tunable weight configuration

---

## Epic 4 — API Surface
**Goal:** Expose scoring via stable endpoints.

### Tasks
- [ ] `GET /api/score/:username`
- [ ] Return output contract:
  - [ ] `slop_score`
  - [ ] `tier`
  - [ ] `confidence`
  - [ ] `top_signals[]`
  - [ ] `scoring_window`
- [ ] Add request validation + error handling
- [ ] Add API-level tests (happy path + edge cases)

### Deliverables
- Production-ready scoring API endpoint

---

## Epic 5 — Core Product UI
**Goal:** Build the primary user experience end-to-end.

### Tasks
- [ ] Build homepage with username input
- [ ] Add loading states (funny but concise)
- [ ] Build result page route `/u/[username]`
- [ ] Render score gauge + tier explanation
- [ ] Render signal breakdown cards ("why this score")
- [ ] Render confidence badge + scoring window label
- [ ] Add empty/error states for low/no data users

### Deliverables
- Fully usable MVP flow from input to score

---

## Epic 6 — Virality Layer (Share + OG)
**Goal:** Make results easy to post and spread.

### Tasks
- [ ] Generate dynamic OG image from result payload
- [ ] Add share CTA (copy link / download card)
- [ ] Ensure score page metadata is social-preview ready
- [ ] Add screenshot-friendly result layout

### Deliverables
- Shareable result assets that drive loops

---

## Epic 7 — Leaderboard (Default Public)
**Goal:** Add discovery surface for viral growth.

### Tasks
- [ ] Define leaderboard data model
- [ ] Add persistence for recent scored users
- [ ] Rank by slop score (with confidence floor)
- [ ] Build `/leaderboard` page
- [ ] Show last-updated timestamp per user
- [ ] Add abuse guardrails (basic spam protection)

### Deliverables
- Public leaderboard with stable ranking behavior

---

## Epic 8 — Safety, Transparency, and Policy
**Goal:** Avoid misleading claims while keeping the joke fun.

### Tasks
- [ ] Add prominent heuristic/satire disclaimer on results
- [ ] Create "How scoring works" page
- [ ] Add confidence meaning tooltip/copy
- [ ] Add Terms/Privacy minimal pages for launch
- [ ] Define policy for username removal/hide request (optional post-MVP)

### Deliverables
- Clear and responsible communication of score limitations

---

## Epic 9 — Performance & Reliability
**Goal:** Keep response times fast and behavior robust.

### Tasks
- [ ] Add cache strategy (in-memory or Redis)
- [ ] Define cache TTL (start with 12h, tune later)
- [ ] Add server-side logging/telemetry
- [ ] Add request throttling/IP rate limit
- [ ] Benchmark p95 response time and optimize bottlenecks

### Deliverables
- p95 <10s target for common user lookups

---

## Epic 10 — Launch Readiness
**Goal:** Calibrate quality and ship confidently.

### Tasks
- [ ] Create calibration dataset (known coding styles/profiles)
- [ ] Tune signal weights to reduce obvious false positives
- [ ] QA copy consistency (funny + thoughtful)
- [ ] Final UI polish pass
- [ ] Deploy MVP
- [ ] Add post-launch feedback capture

### Deliverables
- Publicly launchable MVP with clear iteration path

---

## Suggested Milestone Cuts

### Milestone A (Buildable MVP)
Epics: 1, 2, 3, 4, 5, 8

### Milestone B (Viral loop)
Epics: 6, 7

### Milestone C (Harden + launch)
Epics: 9, 10
