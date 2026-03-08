# UI / UX Design Guidelines

## Core Spirit
The "Are you going slop?" aesthetic is **monochrome luxe** — almost entirely black and white with surgically precise accent color. It feels like a tool built by developers who care deeply about craft, wrapped in understated satire.

We are judging people's code, so the website itself must feel unapologetically high-quality.

Tone is **sarcastic and witty** — judgmental but playful. We roast behavior, not people. Think "roast comedian at a tech meetup," not "mean-spirited troll."

## Guidelines

### 1. Text Style — Always Lowercase

All UI text must be **lowercase**. This includes:
- Headlines and body copy
- Button labels and CTAs
- Navigation and links
- Labels, badges, and tags
- Score tier names and signal descriptions
- Error messages and empty states
- Tooltip content

**Why:** lowercase creates a consistent, understated voice that fits the monochrome aesthetic. It signals "we're not trying too hard" while still being polished.

**Exceptions:**
- User-generated content (usernames, commit messages, repo names)
- Proper nouns that must retain casing (e.g., "GitHub", "OpenAI")
- Acronyms that would be unreadable lowercase (e.g., "API", "URL")

### 2. Monochrome First
- The palette is near-black (`#09090b`) and white (`#e5e5e5`). Color is earned, not default.
- Score colors (green, amber, rose) appear **only** on score numbers and small status indicators — never on card borders, glows, or backgrounds.
- The primary rose accent is used sparingly: CTAs, active states, and the "slop" gradient text.
- Borders are barely visible (`rgba(255,255,255,0.07)` in dark mode). Cards float through subtle elevation, not outlined containment.
- **Third-party brand icons** (e.g. social share buttons) must use `fill="currentColor"` — no brand colors. Icons live in `src/components/icons/` and are sourced from [svgl](https://svgl.app).

### 3. Tooltips & Contextual Help

Use shadcn/ui Tooltip for explanatory content:
- **Trigger:** Icon buttons, flag badges, or inline help icons
- **Content:** Brief, witty explanations (keep it lowercase)
- **Mobile:** Tooltips must work on tap (not just hover)
- **Styling:** Dark theme matching — no arrows, subtle border (`rgba(255,255,255,0.1)`), bg-card background
- **Max-width:** 280px to prevent overwhelming

Example use cases:
- Flag badges in commit list (explaining what "ai crumbs" or "velocity spike" means)
- Confidence level indicators
- Scoring signal breakdowns

### 4. Pure CSS & Tailwind Native
- **No Framer Motion**. Keep the bundle size low and respect the standard CSS engine.
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` for springy, snappy transitions.
- Animations are short (0.2–0.5s) and purposeful. Nothing loops unless it's the gauge.

### 5. Restraint Over Spectacle
- **No glows**, no shimmer effects, no scanline overlays, no colored border glow on hover.
- Card hover: `translateY(-1px)` + subtle shadow shift + border opacity increase. That's it.
- Buttons respond with `active:scale-[0.98]`. No other theatrics.
- Form focus: a clean ring transition (`duration-300`), never a scanning animation.

### 6. Typography & Hierarchy
- Inter for display, JetBrains Mono for data and labels.
- Headlines carry weight through size and tracking, not color.
- The word "slop" gets a slow gradient shift (`bg-clip-text`) — the single allowed flourish on the homepage.
- Links use expanding bottom-border underlines (`group-hover:w-full`), never color-only hover states.
- **All text lowercase** (see section 1) — even headlines read as "are you going to slop?"

### 7. Purposeful Animation
- **Entrance**: `.animate-rise` — 12px translateY, 0.5s, custom bezier. Clean fade-in without blur or scale.
- **Staggering**: Sequential `animation-delay` on lists for a cascading reveal.
- **The Slop Gauge**: Purely CSS-driven. Needle sweep + arc fill, 1.5s duration. This is the hero moment.
- **Investigation View**: Clean progress bar with `duration-1000 ease-out`. Step indicators use simple dots and opacity transitions.

### 8. Score Colors
Score colors are muted and purposeful, not neon:
- **Low** (good): Emerald — `#059669` light / `#34d399` dark
- **Mid**: Amber — `#d97706` light / `#fbbf24` dark
- **High** (bad): Rose (matches primary) — `#e11d48` light / `#fb7185` dark

These appear on: score numbers, gauge gradients, small status dots. Never on: card borders, backgrounds, or glow effects.

### 9. Slop Heatmap (Contribution Calendar)

A GitHub-style contribution calendar (`src/app/u/[username]/slop-heatmap.tsx`) that visualizes a user's commit activity colored by slop density rather than volume.

**Layout:**
- 7-row × N-week grid (Monday-aligned), spanning up to 180 days.
- Left axis: day-of-week labels (Mon, Wed, Fri). Top axis: month labels.
- Cells auto-size via `ResizeObserver` to fill the container width.

**Color scale (5 levels):**
Uses the full emerald → amber → rose spectrum (matching the gauge), not transparent variants of a single hue. Empty cells are near-invisible (`opacity ~0.03`) so active cells pop like signals on a dark grid.

| Level | Condition | Color |
|-------|-----------|-------|
| 0 | No commits | near-invisible empty |
| 1 | All clean (0% flagged) | emerald (`--slop-green`) |
| 2 | ≤50% flagged | amber (`--heatmap-low`) |
| 3 | ≤80% flagged | warm-red (`--heatmap-mid`) |
| 4 | >80% flagged | rose (`--slop-red`) |

**Time-range filter:**
- Toggle bar: `6m`, `3m`, `1m`, `1w`. Default is `6m`.
- Active pill uses solid inverted style (`bg-foreground text-background`) with `active:scale-[0.96]`.
- The full grid always renders; out-of-range cells are dimmed to `opacity: 0.15` — never hidden — so the user keeps spatial context.

**Insight line:**
- Computed snarky one-liner between header and grid, based on slop streak length, flagged-day %, or hottest month.
- Examples: *"14-day slop streak. couldn't even take a break from the machine."*, *"zero flags on the board. either you're legit or you're good at hiding."*

**Animation:**
- Cells enter with a staggered scale + opacity transition (`8ms` delay per column, `cubic-bezier(0.34, 1.56, 0.64, 1)` spring).
- Pure CSS transitions, no animation libraries.

**Interactions:**
- Cells with commits show a rich tooltip on hover (shadcn Tooltip) with date, green/red ratio bar, `flagged/total` count, and sarcastic vibe label (*"nothing worth subpoenaing"* / *"light prompt residue"* / *"human presence not independently verified"* / *"operator appears to have left the building"*).
- Interactive cells have `role="button"`, `tabIndex`, and `aria-label` for keyboard accessibility.

**Card treatment:** Subtle `border-t-2 border-t-primary/15` top accent border to differentiate from generic cards.

**Legend footer:** `clean ▪▪▪▪ pure slop` color scale (12px swatches) + active-day count + flagged-% stat for the selected range.

### 10. Lab Notes (Editorial Changelog)

The `lab notes` page (`src/app/lab-notes/page.tsx`) is the product's release ledger. It should feel like part of the same system, not a separate blog theme.

**Layout:**
- Narrow centered column (`max-w-4xl`)
- Simple page header with back link, title, subtitle, and compact stats strip
- Date-grouped ledger below, not a theatrical vertical timeline
- Each entry rendered as a restrained card inside a bordered container

**Tone:**
- Drier than the homepage
- More "release log with opinions" than "marketing copy"
- Entries must be grounded in real shipped work
- No fabricated milestones or backfilled lore

**Metadata row:**
- JetBrains Mono for tag, commit link, and badges
- Optional version chips may sit beside the tag as quiet release metadata (`v0.0.2`, not a hero headline)
- Commit hashes link to GitHub and may appear as `commit [abc1234] and [def5678]`
- `generated by ai` badge is acceptable here because the joke is repeated structurally, not shouted in body copy

**Media-backed entries:**
- Release media may appear inline below the body copy when a note has something worth showing
- Videos sit inside a darker inset frame with a soft vignette, compact controls, and no giant marketing chrome
- Media should read like supporting evidence inside the ledger, not a separate hero banner or microsite
- Keep the treatment within the existing card width; mobile should still feel narrow, tidy, and editorial

**Visual treatment:**
- Same monochrome-luxe card language as the homepage and wall of shame
- Thin borders, muted foreground, minimal rose accent
- No decorative dots, forensic board lines, or faux-terminal clutter
- Hover states should be subtle (`card-lift` territory, not a special new effect)

## TL;DR
Black and white. One accent color. Animate with intention. Let the content do the talking.

**And remember:** everything lowercase. witty, not mean. tooltips for context.
