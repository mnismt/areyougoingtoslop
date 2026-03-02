# 360-Degree Security Audit — areyougoingtoslop

**Date:** 2026-03-02
**Conducted by:** Senior DevSecOps Engineering Team
**Methodology:** Static code analysis, architecture review, threat modeling
**Scope:** Full codebase — API routes, server logic, client components, infrastructure config, dependencies

---

## Executive Summary

The audit identified **37 findings** across five security domains. The highest risk is the presence of **live credentials in local `.env` files** — a GitHub Personal Access Token and a production Upstash Redis connection string (including password). While the `.gitignore` correctly excludes `.env*`, these files should be treated as compromised: rotate all credentials immediately and verify they have never appeared in git history.

Beyond the credentials issue, the app has a well-implemented scoring engine and safe React rendering with no XSS vectors, but several medium-priority hardening gaps exist around rate limiting, authentication on operational endpoints, and missing HTTP security headers.

| Severity | Count |
|----------|-------|
| Critical | 5 |
| High | 10 |
| Medium | 14 |
| Low / Info | 8 |
| **Total** | **37** |

---

## Risk Matrix

```
LIKELIHOOD
    High  │  [M4][M5][M6]  │  [C1][C2][C3][C4]  │  [C5]
          │                │  [H1][H2]           │
  Medium  │  [L1][L2][L3]  │  [H3][H4][H5]       │  [H6][H7][H8][H9][H10]
          │  [L4][L5]      │  [M1][M7][M8][M9]   │
     Low  │  [I1][I2][I3]  │  [M2][M3][M10]      │  [M11][M12][M13][M14]
          └────────────────┴─────────────────────┴──────────────────────
              Low Impact       Medium Impact          High Impact
```

---

## Domain 1 — Secrets & Infrastructure (Task #2)

### C1. Live GitHub PAT in local `.env` file
**Severity:** Critical | `/.env:1-2`

A valid GitHub Personal Access Token is present in the local `.env` file. Although `.gitignore` excludes this file (`/.env*`), the token may have been committed in git history before the rule was established, or could be exposed via accidental editor sync, backup tools, or CI secret scanning.

**Immediate actions:**
1. Revoke the token at GitHub → Settings → Developer Settings → Personal Access Tokens.
2. Run `git log --all --full-history -- .env` to check if it ever entered history; if so, purge with `git filter-repo --path .env --invert-paths`.
3. Generate a new token with the minimum required scope (likely only `public_repo` read).

---

### C2. Production Redis credentials in local `.env.production`
**Severity:** Critical | `/.env.production:12`

A production Upstash Redis connection string including the plaintext password is in `.env.production`. Same gitignore risk as C1 applies.

**Immediate actions:**
1. Rotate the Upstash Redis token in the Upstash dashboard.
2. Verify this file is not tracked: `git ls-files .env.production`.
3. Purge from history if tracked.

---

### C3. Live GitHub PAT duplicated in `.env.production`
**Severity:** Critical | `/.env.production:1-2`

The same GitHub PAT from C1 also appears in `.env.production`. Both must be revoked and replaced.

---

### C4. Dev Redis connection over plaintext (`redis://`)
**Severity:** Critical (in context) | `/.env:12`

The dev `.env` uses a `redis://` URL pointing to a network host (a Tailscale IP). This transmits authentication credentials in plaintext on the wire. If this is a remote host, a network observer can capture the password.

**Remediation:** Use `redis://localhost:6379` for local dev or `rediss://` with TLS. Production already uses `rediss://` — good.

---

### C5. GitHub tokens stored as plaintext in Redis
**Severity:** Critical | `src/server/queue/github-request-queue.ts:1115-1121`

Per-request GitHub tokens are stored verbatim in Redis as `ays:gh:req:token:<request_id>` with a short TTL. Any party with Redis read access recovers live tokens.

**Remediation:** Either pass the token only in memory (not through Redis), or encrypt it at rest using a symmetric key held only by the application process.

---

### H1. `REDIS_URL` missing causes silent degradation, not fast-fail
**Severity:** High | `src/server/leaderboard/store.ts:33-38`, `src/server/queue/github-request-queue.ts:302-308`

When `REDIS_URL` is absent, the app returns `null` and disables Redis-backed features silently. An operator won't notice until data is lost.

**Remediation:** Fail fast at startup with a clear error when `REDIS_URL` is required.

---

### H2. GitHub API errors may log raw response body
**Severity:** High | `src/server/github/raw-client.ts:126-130`

```typescript
throw new GitHubError(`GitHub API error: ${response.status} ${text}`, response.status)
```

If GitHub's error body contains auth header echoes or token references, they propagate into application logs and potentially client error responses.

**Remediation:** Log `status` + sanitized message server-side; return a generic string to clients.

---

### M1. Redis key namespace collision risk
**Severity:** Medium | `src/server/leaderboard/store.ts:22`, `src/server/queue/github-request-queue.ts:151-155`

Keys use short prefixes (`ays:leaderboard:v1:state`, `ays:gh:req:*`). If multiple deployments (staging, prod) share the same Redis instance, keys collide.

**Remediation:** Add a deployment-specific namespace via env var: `AYS_REDIS_PREFIX=prod`.

---

### M2. Redis client has no connect/command timeouts
**Severity:** Medium | `src/server/leaderboard/store.ts:41-46`

The `ioredis` client is created without `connectTimeout` or `commandTimeout`. A stalled Redis will hang all request handlers indefinitely.

**Remediation:**
```typescript
new Redis(url, { connectTimeout: 5000, commandTimeout: 10000, ... })
```

---

### M3. Console logs may expose sensitive context
**Severity:** Medium | Multiple locations

`console.warn/error` calls in the queue and leaderboard modules are sent to stdout without field masking. If a log aggregator picks these up, structured fields (usernames, internal paths) are visible.

**Remediation:** Use structured logging with a redaction layer for any field named `token`, `password`, `url`, or `key`.

---

## Domain 2 — API Security (Task #1)

### H3. No authentication on operational endpoints
**Severity:** High | `src/app/api/queue/github/route.ts:7-14`

`GET /api/queue/github` returns internal queue diagnostics — worker health, retry counts, consumer state — with no authentication. An attacker can use this to profile the system's load, infer GitHub token exhaustion, and time coordinated attacks.

**Remediation:** Gate behind a static `Authorization: Bearer <ops-token>` check, or restrict to internal-only routing at the reverse proxy.

---

### H4. No authentication on score job creation or polling
**Severity:** High | `src/app/api/score/[username]/jobs/route.ts:8-30`, `src/app/api/score/jobs/[jobId]/route.ts:8-26`

Both endpoints accept any unauthenticated request. Combined with no per-IP job limit (see H5), this is the primary DoS vector.

---

### H5. No rate limit on score job creation
**Severity:** High | `src/app/api/score/[username]/jobs/route.ts`

Unlike the feedback endpoint, there is zero per-IP rate limiting on `POST /api/score/[username]/jobs`. An attacker flooding this endpoint with unique usernames will:
- Exhaust the GitHub token's 5 000 req/hour quota in seconds.
- Fill the in-memory job map (see M7).
- Deny service to legitimate users.

**Remediation:** Apply a `MemoryRateLimiter` (the one used on feedback already exists) at ≤10 job creations per IP per 10 minutes.

---

### H6. SSRF risk in OG avatar fetch
**Severity:** High | `src/app/api/og/og-data.ts:186`

```typescript
const response = await fetcher(`https://github.com/${username}.png`, ...)
```

The `fetcher` parameter is injectable (designed for testing). If the production code path ever accepts a custom fetcher from outside, this becomes SSRF. Even without injection, the URL construction assumes the username was validated upstream — a layered validation gap.

**Remediation:** Construct and validate the URL with `new URL(...)` and assert the hostname is `github.com` before fetching.

---

### H7. Job ID IDOR — no ownership check on job polling
**Severity:** High | `src/app/api/score/jobs/[jobId]/route.ts:9-10`

Job IDs are UUIDs, but the polling endpoint performs no ownership validation. User A who somehow obtains User B's `jobId` can read their intermediate scoring results. The data is low-sensitivity today, but establishing the pattern is important before adding more data to job snapshots.

**Remediation:** Store requesting IP (or a session token) with the job at creation and assert it matches on GET.

---

### M4. Unvalidated `limit` parameter in leaderboard
**Severity:** Medium | `src/app/api/leaderboard/route.ts:5-9`

```typescript
const limitParam = Number(searchParams.get('limit'))
```

`Number('1e308')` produces `Infinity`, which then passes `Number.isFinite()` = `false` and falls through to `undefined` — harmless today but fragile.

**Remediation:** Use `parseInt(..., 10)` and validate bounds explicitly before use.

---

### M5. JSON from Redis deserialized with `as` type cast only
**Severity:** Medium | `src/server/api/score-jobs.ts:200`, `src/app/api/feedback/route.ts:31`

```typescript
return JSON.parse(raw) as ScoreJobSnapshot
```

TypeScript `as` casts provide zero runtime safety. A corrupted or injected Redis value will silently fail at runtime with confusing type errors rather than returning a clear parsing error.

**Remediation:** Use `zod` or `valibot` schemas to validate the shape of data coming out of Redis before trusting it.

---

### M6. Unvalidated `jobId` format
**Severity:** Medium | `src/app/api/score/jobs/[jobId]/route.ts:9`

`jobId` is not validated as a UUID before being passed to `getScoreJob()`. A garbage value like `../../../../etc/passwd` cannot cause path traversal here (it's a Map key), but the lack of format checks leaves a bruteforce/enumeration surface.

**Remediation:**
```typescript
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId))
  return NextResponse.json({ error: 'invalid_job_id' }, { status: 400 })
```

---

### M7. Feedback endpoint stores raw IP addresses
**Severity:** Medium | `src/app/api/feedback/route.ts:76-82`

Plaintext IPs are persisted alongside feedback messages in `.data/feedback.json`. IPs are personal data under GDPR/CCPA in many jurisdictions.

**Remediation:** Store a SHA-256 hash of the IP for abuse-detection purposes instead of the raw value.

---

## Domain 3 — Rate Limiting & Abuse (Task #3)

### H8. IP spoofing bypasses feedback rate limiter
**Severity:** High | `src/app/api/feedback/route.ts:20-26`

The client IP is extracted as the **leftmost** value of `X-Forwarded-For`:
```typescript
return forwarded.split(',')[0]?.trim()
```

An attacker prefixes a unique fake IP on every request, getting a fresh rate-limit bucket each time. The 5-per-10-min limit is completely bypassed.

**Remediation:** Use the **rightmost** IP in `X-Forwarded-For` (closest to the origin, hardest to spoof), or use `X-Real-IP` set by a trusted reverse proxy.

---

### H9. GitHub token exhaustion via job flooding
**Severity:** High | Combined with H5

One score job consumes ~200 GitHub API calls for an active profile. At 5 000 req/hour (unauthenticated: 60), 25 concurrent jobs exhaust the hourly budget, blocking all users for up to an hour. This is a trivial denial-of-service with no current mitigations.

**Remediation:** See H5. A per-IP job creation limit of 3/10 min caps the blast radius to ≤6 concurrent jobs per attacker IP.

---

### H10. In-memory rate limiter does not scale across instances
**Severity:** High | `src/server/rate-limit/memory.ts:17-55`

Each process instance maintains its own `Map`. On a multi-instance deployment (standard on Vercel/Railway), an attacker distributes requests across N instances and effectively multiplies all limits by N.

**Remediation:** Migrate rate limiting state to Redis using `INCR` + `EXPIRE`. Redis is already a dependency.

---

### M8. Score job map is unbounded
**Severity:** Medium | `src/server/api/score-jobs.ts:79-92`

The global `__aysScoreJobsState.jobs` Map accumulates entries until cleanup is triggered lazily on the next `createOrAttachScoreJob()` call. With no per-IP job limit, an attacker fills this map until the process OOMs.

**Remediation:** Enforce a hard cap (e.g., 500 concurrent jobs). When exceeded, return `503 Service Unavailable`.

---

### M9. Leaderboard poisoning
**Severity:** Medium | `src/server/leaderboard/store.ts:99-199`

A GitHub account engineered to produce a high slop score can occupy the top of the leaderboard indefinitely. The confidence-floor filter (minimum `medium`) provides mild resistance but is easy to satisfy.

**Remediation:** Track submitting IP and enforce a cool-down before a new entry from the same IP can displace an existing entry. Flag anomalous scores (>2σ from the current mean) for manual review.

---

## Domain 4 — Dependencies, Supply Chain & Security Headers (Task #4)

### H11. No HTTP security headers configured
**Severity:** High | `next.config.ts`

`next.config.ts` contains only a URL rewrite rule and sets **no security response headers**. The following are absent:

| Header | Risk if missing |
|--------|----------------|
| `Content-Security-Policy` | XSS escalation if a future injection vector emerges |
| `X-Frame-Options: DENY` | Clickjacking |
| `X-Content-Type-Options: nosniff` | MIME-type sniffing attacks |
| `Strict-Transport-Security` | Downgrade / MITM attacks |
| `Referrer-Policy` | Leaks path in `Referer` header to third-party origins |
| `Permissions-Policy` | Camera/mic access if attacker loads page in iframe |

**Remediation:** Add a `headers()` configuration block to `next.config.ts`:
```typescript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // Add CSP once inline styles and scripts are inventoried
    ],
  }]
}
```

---

### M10. Google Fonts loaded at OG render time with no error boundary
**Severity:** Medium | `src/app/api/og/og-fonts.ts:15-23`

The `loadGoogleFont()` function makes two sequential outbound HTTP calls to `fonts.googleapis.com` and the resolved font CDN URL at OG image render time. Issues:

1. **External dependency at request time:** If Google Fonts is slow or unavailable, OG card generation hangs for the full request timeout.
2. **Regex parsing of CSS:** `css.match(/src: url\((.+)\) format\(...)/)` parses third-party CSS with a regex. A format change in Google's CSS would silently break OG images and the error is swallowed (`return []`).
3. **SSRF vector (theoretical):** The resolved font URL (`match[1]`) is fetched without asserting the hostname is `fonts.gstatic.com`. If Google's CDN is somehow redirected (e.g., via DNS poisoning), arbitrary URLs could be fetched.

**Remediation:**
- Bundle font files statically at build time instead of fetching at runtime.
- Assert `new URL(match[1]).hostname === 'fonts.gstatic.com'` before the second fetch.
- Add a short timeout (`AbortSignal.timeout(3000)`) on both fetches.

---

### M11. Hardcoded canonical domain in share actions
**Severity:** Medium | `src/app/u/[username]/share-actions.tsx:34`

`https://areyougoingtoslop.com` is hardcoded rather than derived from `NEXT_PUBLIC_SITE_URL`. On staging or preview deployments, shared links point to production.

**Remediation:**
```typescript
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://areyougoingtoslop.com'
```

---

### M12. `NEXT_PUBLIC_SITE_URL` not documented as required
**Severity:** Medium | `docs/DEPLOYMENT.md:6`

The deployment doc lists this env var but does not mark it as required, and there is no startup validation. If unset, OG links and share actions fall back to hardcoded values.

---

### L1. No lockfile integrity check in CI
**Severity:** Low | `package.json`

There is no evidence of `bun install --frozen-lockfile` in a CI pipeline, meaning dependency versions can silently drift from `bun.lockb`. This is a supply-chain hygiene issue.

**Remediation:** Run `bun install --frozen-lockfile` in CI.

---

### L2. `@types/node` pinned to `^20` while runtime may be Node 22+
**Severity:** Low | `package.json:33`

A type/runtime mismatch can mask type errors in Node API usage. Align `@types/node` with the actual runtime version.

---

## Domain 5 — Data Flow & Client-Side Security (Task #5)

### M13. Commit messages exposed at full length may contain PII
**Severity:** Medium | `src/server/scoring/engine.ts:335`

`analyzed_commits` returns up to 200 characters of each flagged commit message to the client. Developers sometimes include email addresses, internal tooling names, or project codenames in commit messages.

**Remediation:** Truncate to 80 chars. Optionally strip email-like patterns (`\S+@\S+\.\S+`) server-side before serialization.

---

### M14. Feedback stored in plaintext file with raw IP addresses
**Severity:** Medium | `src/app/api/feedback/route.ts:76-82`

See M7. Additionally, the storage path defaults to `.data/feedback.json` (relative, guessable). While not web-accessible, it creates a data-at-rest risk.

**Remediation:** Use an absolute path. Hash IPs. Consider Redis with TTL instead of a flat file.

---

### L3. No CSRF protection on state-changing API calls
**Severity:** Low | `src/app/fine-print/feedback-form.tsx:21-24`

Feedback submissions are `fetch()` POST calls without a CSRF token. A malicious site could submit feedback on behalf of a visiting user. Impact is low (feedback spam), but establishes a bad pattern if higher-impact state-changing routes are added later.

**Remediation:** Add `SameSite=Strict` to session cookies (if any), or implement a CSRF token round-trip for POST routes.

---

### L4. Leaderboard has no opt-out mechanism
**Severity:** Low | `src/server/leaderboard/store.ts`

Any user whose profile is scored automatically appears in the public leaderboard. There is no way for a user to remove themselves. This is noted in the fine-print, but should be documented more prominently as a consent consideration.

---

### I1. Commit message XSS — no vector found
**Severity:** Info | `src/app/u/[username]/commit-list.tsx:154`

React renders commit messages as text nodes (no `dangerouslySetInnerHTML`). XSS is not possible through this path. No action needed.

---

### I2. Username rendering — no vector found
**Severity:** Info | `src/app/u/[username]/score-live-view.tsx:146`

Usernames are React text nodes and validated server-side to GitHub's allowed charset. No XSS vector. No action needed.

---

### I3. Prototype pollution — not detected
**Severity:** Info

No `Object.assign()` or spread over untrusted external objects found. No action needed.

---

## Remediation Roadmap

### Phase 0 — Immediate (Today)

These actions take minutes and must happen before anything else:

- [ ] **Revoke** the GitHub Personal Access Token found in `.env` / `.env.production`.
- [ ] **Rotate** the Upstash Redis password.
- [ ] **Verify** neither file has ever been committed: `git log --all --full-history -- .env .env.production`.
- [ ] If ever committed: purge with `git filter-repo` and force-push.
- [ ] Generate replacement credentials and inject via deployment environment secrets only (never in files).

---

### Phase 1 — Critical Path (This Sprint)

| ID | Action | Effort |
|----|--------|--------|
| H8 | Fix IP extraction in rate limiter to use rightmost `X-Forwarded-For` value | 15 min |
| H5 | Add `MemoryRateLimiter` to `POST /api/score/[username]/jobs` | 30 min |
| H3 | Add `Authorization` header check to `GET /api/queue/github` | 30 min |
| H11 | Add security headers block to `next.config.ts` | 45 min |
| C5 | Stop storing GitHub tokens in Redis; pass in-process only | 1-2 h |

---

### Phase 2 — High Priority (Next Sprint)

| ID | Action | Effort |
|----|--------|--------|
| H10 | Migrate rate limit state to Redis (shared across instances) | 1 day |
| H7 | Add IP/ownership binding to score jobs | 2 h |
| M5 | Add `zod` schema validation for Redis-deserialized data | 1 day |
| M6 | Validate `jobId` as UUID format before lookup | 15 min |
| M4 | Fix `limit` param to use `parseInt` + explicit bounds | 15 min |
| M10 | Bundle OG fonts statically; add hostname assertion on CDN fetch | 2 h |
| M7/M14 | Hash IPs in feedback storage | 1 h |

---

### Phase 3 — Medium Priority (Following Sprint)

| ID | Action | Effort |
|----|--------|--------|
| M8 | Enforce hard cap on concurrent score jobs | 1 h |
| M9 | Add leaderboard poisoning cooldown and anomaly detection | 2 h |
| M2 | Add connect/command timeouts to Redis clients | 30 min |
| M11/M12 | Use `NEXT_PUBLIC_SITE_URL` for canonical domain | 15 min |
| M13 | Truncate commit messages to 80 chars server-side | 15 min |
| L3 | Add CSRF token middleware | 2 h |
| L1 | Add `--frozen-lockfile` to CI install step | 15 min |

---

## Positive Observations

The following were reviewed and found to be implemented correctly:

- **React XSS safety:** Commit messages and usernames are rendered as React text nodes throughout — no `dangerouslySetInnerHTML`. GitHub's untrusted content cannot cause XSS.
- **Username validation:** `isValidGitHubUsername()` enforces GitHub's actual constraints server-side before any downstream use.
- **Prototype pollution:** No patterns found that spread untrusted external data onto objects.
- **ReDoS:** The username regex `^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37})$` uses only bounded, non-nested quantifiers. Not vulnerable.
- **Production Redis TLS:** `.env.production` uses `rediss://` (TLS). Good.
- **Optimistic locking on leaderboard:** Redis `WATCH/MULTI/EXEC` with 10-retry backoff correctly prevents concurrent write races.
- **`encodeURIComponent` on share URLs:** Twitter/Reddit share intent URLs properly encode untrusted content.
- **Feedback rate limiting exists:** 5 req/IP/10 min on `/api/feedback` (though bypassable — see H8).
- **Job cleanup:** 30-minute TTL on job state prevents indefinite accumulation under normal load.

---

## Appendix — Finding Index

| ID | Domain | Severity | Title |
|----|--------|----------|-------|
| C1 | Secrets | Critical | GitHub PAT in local `.env` |
| C2 | Secrets | Critical | Production Redis credentials in `.env.production` |
| C3 | Secrets | Critical | GitHub PAT duplicated in `.env.production` |
| C4 | Secrets | Critical | Dev Redis over plaintext network connection |
| C5 | Secrets | Critical | GitHub tokens stored plaintext in Redis |
| H1 | Secrets | High | Silent REDIS_URL degradation instead of fast-fail |
| H2 | Secrets | High | Raw GitHub error body propagated to logs |
| H3 | API | High | No auth on `/api/queue/github` |
| H4 | API | High | No auth on score job creation/polling |
| H5 | API/Abuse | High | No rate limit on score job creation |
| H6 | API | High | SSRF risk in OG avatar fetch |
| H7 | API | High | Job ID IDOR — no ownership check |
| H8 | Abuse | High | IP spoofing bypasses feedback rate limiter |
| H9 | Abuse | High | GitHub token exhaustion via job flooding |
| H10 | Abuse | High | In-memory rate limiter not shared across instances |
| H11 | Deps/Headers | High | No HTTP security headers configured |
| M1 | Secrets | Medium | Redis key namespace collision risk |
| M2 | Secrets | Medium | Redis client has no connect/command timeouts |
| M3 | Secrets | Medium | Unstructured logs may expose sensitive context |
| M4 | API | Medium | Unvalidated `limit` param in leaderboard endpoint |
| M5 | API | Medium | Redis deserialization uses `as` cast — no runtime validation |
| M6 | API | Medium | `jobId` not validated as UUID |
| M7 | API | Medium | Feedback endpoint stores raw IP addresses |
| M8 | Abuse | Medium | Score job map is unbounded |
| M9 | Abuse | Medium | Leaderboard poisoning |
| M10 | Deps | Medium | OG fonts fetched from Google at request time |
| M11 | Deps | Medium | Hardcoded canonical domain in share actions |
| M12 | Deps | Medium | `NEXT_PUBLIC_SITE_URL` not validated at startup |
| M13 | Data Flow | Medium | Commit messages may contain PII |
| M14 | Data Flow | Medium | Feedback stored plaintext with raw IPs |
| L1 | Deps | Low | No `--frozen-lockfile` in CI |
| L2 | Deps | Low | `@types/node` version mismatch with runtime |
| L3 | Data Flow | Low | No CSRF protection on POST routes |
| L4 | Data Flow | Low | Leaderboard has no opt-out mechanism |
| I1 | Data Flow | Info | Commit message XSS — no vector found (safe) |
| I2 | Data Flow | Info | Username rendering — no vector found (safe) |
| I3 | Data Flow | Info | Prototype pollution — not detected (safe) |
