# Epic 12 — UI Vibes Polish

## Goal
Elevate the frontend from a standard UI to a "premium," snappy experience using **only pure CSS and Tailwind** (no Framer Motion).

## Why this Epic Exists
Even though this is a joke website, executing the joke perfectly requires an interface that feels serious, highly engineered, and deeply satisfying to use. It must balance a "dev-tool" aesthetic with "consumer-grade" polish.

## Scope
- Global easing functions and entrance animations.
- Hero text, typography, and link hover states.
- Tactile physical states for Inputs and Buttons.
- Lifts, glows, and pops for Avatar and user Cards.
- Refactoring the Slop Gauge to use pure CSS keyframes rather than React state jumps.
- Smoothing out polling-based loading bar jumps.

## Tasks
- [x] Create `DESIGN.md` establishing the UI spirit and principles.
- [x] Update global `animate-rise` in `globals.css` with a springier `cubic-bezier(0.16, 1, 0.3, 1)` and larger `translateY`.
- [x] Add dynamic staggered delays to Leaderboard rows (`animation-delay: index * 40ms`).
- [x] Update "slop" text in the hero to an animated pulse gradient.
- [x] Add expanding underline effect to navigation and footer links.
- [x] Add `active:scale-[0.98]` and hover drop-shadows to the `Button` component.
- [x] Add `duration-300` to the `Input` component focus transitions.
- [x] Apply hover lifts (`hover:-translate-y-1`) to user cards and hover scaling to inner Github Avatars.
- [x] Rewrite `slop-gauge.tsx` to utilize pure CSS `@keyframes sweep` (for the needle) and `@keyframes fill-arc` (for the stroke dash) so it animates cleanly.
- [x] Increase duration (to `duration-1000`) of the live investigation progress bar fills to disguise API polling jumps.

## Definition of Done
- The app feels demonstrably snappier and higher quality to navigate.
- No new heavy JS animation libraries (like framer-motion) were added to the dependency tree.
