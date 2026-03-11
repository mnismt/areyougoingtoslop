# Epic 14 — Slop Heatmap (Contribution Calendar)

## Goal
Add a GitHub-style contribution calendar to the user score page that visualizes daily commit activity colored by slop density, giving users a temporal view of their AI-assisted coding patterns.

## Why this Epic Exists
The score card shows a single number. The heatmap tells the *story* — when did AI usage spike? Was it always this way or a recent shift? It makes the result page richer, more shareable, and more insightful without adding noise.

## Scope
- GitHub-style SVG heatmap on `/u/[username]` below the score card
- 5-level color scale from clean (green) to pure slop (red)
- Client-side time-range filtering (6m / 3m / 1m / 1w)
- Responsive cell sizing + staggered entrance animation
- Tooltip with per-day commit + flagged counts
- Keyboard-accessible interactive cells

## Out of Scope
- Click-to-drill-down into a specific day's commits
- Server-side aggregation or separate API endpoint
- Heatmap on the leaderboard or other pages

## Tasks

### Core
- [x] Build `slop-heatmap.tsx` component with SVG grid rendering
- [x] Implement `buildGrid()` — Monday-aligned week grid from `windowDays`
- [x] Implement `DayBucket` aggregation from `AnalyzedCommit[]`
- [x] Implement 5-level `slopLevel()` color mapping (empty / clean / low / mid / slop)
- [x] Add CSS custom properties for heatmap colors (`--heatmap-empty`, `--slop-green`, `--heatmap-low`, `--heatmap-mid`, `--slop-red`)
- [x] Add time-range filter toggle (6m / 3m / 1m / 1w) with dimming for out-of-range cells
- [x] Add `ResizeObserver`-based responsive cell sizing
- [x] Add staggered scale + opacity entrance animation (pure CSS transitions)
- [x] Add shadcn Tooltip for interactive cells (date, commit count, flagged count)
- [x] Add accessibility attributes (`role`, `tabIndex`, `aria-label`) to interactive cells
- [x] Add legend footer (color scale + active-day count)

### Visual polish
- [x] Fix color ramp — replace transparent-rose mid levels with proper emerald → amber → warm-red → rose spectrum
- [x] Reduce empty-cell prominence — near-invisible empties so active cells pop
- [x] Add snarky insight line — computed slop streak, hottest month, or flagged-% quip below header
- [x] Rich tooltip — green/red ratio bar + flagged count + sarcastic vibe label ("nothing worth subpoenaing" / "light prompt residue" / "human presence not independently verified" / "operator appears to have left the building")
- [x] Upgrade filter pills — solid inverted active state (`bg-foreground text-background`) + `active:scale-[0.96]`
- [x] Card accent — subtle `border-t-2 border-t-primary/15` top border
- [x] Legend polish — larger swatches (12px), `text-[11px]`, flagged-% stat in footer

### Animation upgrade
- [x] Replace manual CSS transition system with `motion/react` (`motion.rect`)
- [x] Remove `appeared`, `hasEnteredRef`, `filterTransitioning`, `filterWaveReady`, `prevInRangeRef` state
- [x] Entrance animation: `initial={{ opacity: 0, scale: 0 }}` → `animate` with per-column spring stagger
- [x] Filter wave: direction-aware stagger (left-to-right when narrowing, right-to-left when widening)
- [x] Data arrival: `fill` transition for smooth color updates, CSS pulse class retained

### Remaining
- [ ] Add tests for `slopLevel()` and `buildGrid()` utility functions
- [ ] Add visual regression test or snapshot for heatmap rendering
- [ ] Integrate heatmap into OG image generation (optional stretch)

## Technical Notes

### Data flow
The heatmap is a pure client-side visualization. It receives `AnalyzedCommit[]` and `windowDays` from the parent score view — no additional API calls.

### Color scale
Uses the full emerald → amber → rose spectrum (matching the gauge), not transparent variants of a single hue.

| Level | Condition | Light | Dark |
|-------|-----------|-------|------|
| 0 | No commits | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.03)` |
| 1 | 0% flagged | `#059669` | `#34d399` |
| 2 | ≤50% flagged | `#d97706` (amber) | `#fbbf24` (amber) |
| 3 | ≤80% flagged | `#e87161` (warm-red) | `#f97066` (warm-red) |
| 4 | >80% flagged | `#e11d48` (rose) | `#fb7185` (rose) |

### Insight line
Computed snarky one-liner between the header and grid. Picks the most notable stat:
- Slop streak ≥5 days → *"X-day slop streak. couldn't even take a break from the machine."*
- ≥70% flagged days → *"month was X% machine-assisted. we have the receipts."*
- 0% flagged → *"zero flags on the board. either you're legit or you're good at hiding."*
- <30% flagged → *"mostly human. but we see those outliers."*
- Fallback → *"month raised some flags. just saying."*

### Tooltip
Rich tooltip with green/red ratio bar, `flagged/total` count, and vibe label:
- `"nothing worth subpoenaing"` / `"light prompt residue"` / `"human presence not independently verified"` / `"operator appears to have left the building"`

### Animation
Uses `motion/react` (`motion.rect` SVG primitive) for all cell animations:
- **Entrance:** `initial={{ opacity: 0, scale: 0 }}` with per-column spring stagger (`8ms` delay × column index, `bounce: 0.35`).
- **Filter wave:** Direction-aware stagger — left-to-right when narrowing range (6m→3m), right-to-left when widening (3m→6m). Uses a short-lived `staggerActive` flag cleared by timeout.
- **Data arrival:** `fill` transition (0.5s ease-out) handles color changes; CSS `heatmap-cell-pulse` class retained for the pulse keyframe.
- **Filter dim/undim:** Opacity animates smoothly between 0.15 ↔ 1 via motion's declarative `animate` prop.

## Files
- `src/app/u/[username]/slop-heatmap.tsx` — component implementation
- `src/app/globals.css` — heatmap color custom properties
- `docs/DESIGN.md` § 9 — design guidelines
- `docs/ARCHITECTURE.md` § 6.1 — architecture documentation

## Definition of Done
- Heatmap renders on the score page with correct color mapping
- Time-range filter works without layout shift
- Cells are keyboard-accessible with tooltips
- `bun run typecheck` passes
- Unit tests cover `slopLevel()` and `buildGrid()`
