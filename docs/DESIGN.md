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

## TL;DR
Black and white. One accent color. Animate with intention. Let the content do the talking.

**And remember:** everything lowercase. witty, not mean. tooltips for context.
