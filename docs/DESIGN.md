# UI / UX Design Guidelines

## Core Spirit
The "Are you going slop?" aesthetic balances **premium engineering vibes with satirical intent**. It feels native to developers (monospaced accents, terminal-like colors) but is punctuated by smooth, almost unnecessarily polished micro-interactions and animations.

We are judging people's code, so the website itself must feel unapologetically high-quality.

## Guidelines

### 1. Pure CSS & Tailwind Native
- We rely on modern CSS (via Tailwind) for animations.
- **No Framer Motion**. Keep the bundle size low and respect the standard CSS engine.
- Easing defaults: we prefer custom `cubic-bezier(0.16, 1, 0.3, 1)` for springy, snappy, non-linear transitions.

### 2. Tactile Interfaces
- Inputs and buttons shouldn’t just highlight; they should react physically.
- Use `active:scale-[0.98]` on major CTAs so they feel "pressable."
- Cards should elevate (`hover:-translate-y-1` and shadow tweaks) on hover to encourage interaction.
- Form focus states shouldn't instantly snap. A subtle `duration-300` fade into focus feels more deliberate.

### 3. Typography & Accents
- Headlines should have weight. When emphasizing the word "slop", we use a slow pulsing gradient (`bg-clip-text text-transparent bg-gradient-to-r from-primary to-rose-400`) rather than a flat color.
- Links (like "full wall of shame →" or footer items) shouldn't just change color. They use custom bottom border expansions (`absolute -bottom-1 left-0 h-[1px] w-0 ... group-hover:w-full`) for a modern underline effect.

### 4. The "Vibe" Animations
- Entrance animations: Core components fade and rise in (`.animate-rise` class) utilizing the `24px` translation and custom bezier curves.
- Staggering: When listing items (like the Leaderboard), we delay each row's entrance natively (`animation-delay: calc(var(--idx) * 40ms)`) to create a cascading reveal.
- **The Slop Gauge**: The core interactive visual is purely CSS driven. The gauge needle sweeps to its score (`@keyframes sweep`) and the gradient colored arc physically draws itself in sync (`stroke-dasharray` and `stroke-dashoffset`), taking exactly 1.5 seconds.
- Investigation View: The loading states simulate a "hacker terminal" booting up. The progress bar glides to its destination using `duration-1000 ease-out`, avoiding jarring frame jumps while polling.

## TL;DR
Make it fast. Make it springy. Don't use JS for animations if CSS can do it better.
