# Open Graph (OG) Image System

Dynamic social preview generation for user score results.

---

## Overview

The OG system generates shareable 1200×630 PNG images that render when areyougoingtoslop links are shared on social platforms. Two endpoints serve different purposes:

| Route | Purpose |
|-------|---------|
| `GET /api/og/:username` | Dynamic user score card (also accessible as `/api/og/:username.png`) |
| `GET /api/og/default` | Generic site preview for homepage and unfurl fallbacks |

---

## Architecture

```
GET /api/og/[username]
  → resolveOgData()           // cache-first data resolution
    → getCachedScore()        // 12h in-memory cache hit?
    → scoreUserWithMetadata() // live compute on miss
    → fetchAvatarDataUri()    // github avatar → base64 (parallel)
  → loadOgFonts()             // Inter + JetBrains Mono (cached)
  → renderOgCard()            // react → @vercel/og ImageResponse
  → createOgImageResponse()   // PNG + cache headers
```

---

## Data Resolution (`og-data.ts`)

### Cache Strategy

| Scenario | Behavior |
|----------|----------|
| Cache hit | Return cached result, avatar fetch runs in parallel |
| Cache miss | Live score computation, write result to cache |
| Score error | Map to fallback variant, no cache write |
| Avatar failure | Proceed with initials fallback (no error) |

### Error-to-Variant Mapping

Errors from the scoring layer map to typed fallback cards:

| Error Type | Variant | Card Title |
|------------|---------|------------|
| `GitHubNotFoundError` | `not_found` | ghost account |
| `GitHubOrganizationError` | `organization` | collective entity detected |
| `GitHubRateLimitError` | `rate_limited` | github says chill |
| `GitHubValidationError` | `invalid_username` | invalid username |
| Other / timeout | `unavailable` | the vibes are unclear |

---

## Card Variants (`og-card.tsx`)

### Result Card (`variant: 'result'`)

Displays score data with the monochrome-luxe aesthetic:

- **Header**: Brand + "entertainment purposes only" disclaimer
- **Identity**: Avatar (or initials fallback), username, tier name, tagline
- **Score Block**: Large colored score (green ≤30, amber ≤70, rose >70)
- **Badges**: Confidence level + scoring window
- **Stats Strip**: Commits inspected, repos raided, crime window, intel sources
- **Signals**: Up to 3 top signal chips
- **Status Line**: Optional context (partial snapshot, rate-limited, pagination limited)

### Fallback Cards

All non-result variants use a centered layout with:
- Brand header ("satire, not a factual detector")
- Title + subtitle (witty, lowercase)
- Optional note (monospace clarifier)
- Avatar or placeholder icon

---

## Font Loading (`og-fonts.ts`)

Loads Google Fonts via CSS subsetting for optimal payload:

| Font | Weight | Use |
|------|--------|-----|
| Inter | 400 | Body text |
| Inter | 700 | Headlines, scores |
| JetBrains Mono | 500 | Labels, stats, badges |

Fonts are cached in memory by `font:text` key to avoid re-fetching.

---

## URL Rewrites

The `.png` extension is cosmetic — Next.js rewrites handle it:

```typescript
// next.config.ts
{ source: '/api/og/:username.png', destination: '/api/og/:username' }
```

This allows clean metadata URLs: `/api/og/octocat.png`

---

## Response Headers

```
Content-Type: image/png
Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800
```

- 1 hour browser cache
- 24 hour CDN cache
- 7 day stale-while-revalidate window

---

## Testing

Unit tests cover deterministic rendering and data resolution:

| Test File | Coverage |
|-----------|----------|
| `og-data.test.ts` | Cache hit/miss, live fallback, error mapping, avatar resilience |
| `og-card.test.ts` | Snapshot rendering for result + all fallback variants |
| `[username]/route.test.ts` | Dynamic route smoke (PNG output, cache headers) |
| `default/route.test.ts` | Default route smoke (PNG output, cache headers) |

All OG tests use dependency injection for mocked data and fonts.

---

## Files

| File | Responsibility |
|------|----------------|
| `og-card.tsx` | React component renderer, all visual variants |
| `og-data.ts` | Data resolver with cache-then-live flow |
| `og-fonts.ts` | Google Font loader with memory caching |
| `og-response.ts` | Standardized ImageResponse wrapper + constants |
| `[username]/route.ts` | Dynamic OG endpoint wiring |
| `default/route.ts` | Static default OG endpoint |

---

## Dependencies

- `@vercel/og` (via `next/og`) for ImageResponse
- Google Fonts CDN for typography
- Existing scoring cache (`src/server/cache/`)
- Existing scoring pipeline (`src/server/api/score`)
