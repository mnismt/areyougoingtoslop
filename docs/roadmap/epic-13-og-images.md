# Epic 13 — Dynamic OG Image Generation

## Goal
Implement dynamic Open Graph (OG) image generation for user score results, enabling rich social sharing previews with personalized score cards.

## Why this Epic Exists
Social sharing is a key virality driver. When users share their "slop score" results, the preview card should be compelling, branded, and informative — converting curiosity into clicks.

## Scope
- Dynamic OG card rendering for user profiles (`/api/og/[username]`)
- Default/fallback OG card for homepage (`/api/og/default`)
- Support for `.png` URL extension via Next.js rewrites
- Comprehensive error handling with graceful fallback variants
- Font loading and caching for consistent typography
- Full test coverage for all rendering paths

## Out of Scope
- Static image generation (build-time)
- Custom OG themes per user
- Animated OG images

## Tasks
- [x] Create `og-card.tsx` — variant-driven React renderer with 6 card types (result, organization, not_found, invalid_username, rate_limited, unavailable)
- [x] Create `og-data.ts` — cache-then-live resolver with error-to-variant mapping
- [x] Create `og-fonts.ts` — Google Font loader (Inter + JetBrains Mono) with memory caching
- [x] Create `og-response.ts` — standardized ImageResponse wrapper with cache headers
- [x] Implement `GET /api/og/[username]` — dynamic route with resolver + renderer + fonts
- [x] Implement `GET /api/og/default` — static default OG route
- [x] Add Next.js rewrite for `.png` extension support (`/api/og/:username.png`)
- [x] Update `src/app/layout.tsx` — set global OG image to `/api/og/default.png`
- [x] Update `src/app/u/[username]/page.tsx` — set per-user metadata image to `/api/og/${username}.png`
- [x] Create `og-data.test.ts` — cache hit/miss, error mapping, avatar resilience
- [x] Create `og-card.test.ts` — deterministic rendering for all variants
- [x] Create `[username]/route.test.ts` — dynamic route smoke coverage
- [x] Create `default/route.test.ts` — default route smoke coverage
- [x] Create `docs/og-system.md` — comprehensive system documentation

## Technical Highlights

### Card Variants
All cards follow the monochrome-luxe design system with:
- Dark gradient background with subtle rose accent glow
- Score color coding: green (≤30), amber (≤70), rose (>70)
- Confidence badges with appropriate color coding
- Stats strip: commits inspected, repos raided, crime window, intel sources
- Top signals chips (up to 3)

### Error Handling
Errors map to specific fallback cards with witty, lowercase copy:
- **ghost account** — user not found
- **collective entity detected** — organization accounts
- **github says chill** — rate limited
- **invalid username** — validation failure
- **the vibes are unclear** — general errors

### Caching Strategy
- **Data**: 12-hour in-memory cache (`getCachedScore`)
- **Images**: 1h browser / 24h CDN / 7d stale-while-revalidate
- **Fonts**: In-memory cache by `font:text` key

### Performance
- Avatar fetching runs in parallel with score resolution
- Font subsetting via Google Fonts CSS API
- Dependency injection for testability

## Files Added/Modified

### Core Implementation
- `src/app/api/og/og-card.tsx` — React component renderer
- `src/app/api/og/og-data.ts` — Data resolver layer
- `src/app/api/og/og-fonts.ts` — Font loader
- `src/app/api/og/og-response.ts` — Response utilities
- `src/app/api/og/[username]/route.ts` — Dynamic route
- `src/app/api/og/default/route.ts` — Default route

### Tests
- `src/app/api/og/og-data.test.ts`
- `src/app/api/og/og-card.test.ts`
- `src/app/api/og/[username]/route.test.ts`
- `src/app/api/og/default/route.test.ts`

### Configuration
- `next.config.ts` — URL rewrite for `.png` extension
- `src/app/layout.tsx` — Global OG metadata
- `src/app/u/[username]/page.tsx` — Per-user OG metadata

### Documentation
- `docs/og-system.md` — System documentation
- `docs/README.md` — Updated index

## Definition of Done
- [x] `bun run test` passes
- [x] `bun run typecheck` passes
- [x] All 6 card variants render correctly
- [x] Cache strategy works as expected
- [x] `.png` URLs work for social sharing
- [x] Documentation complete
