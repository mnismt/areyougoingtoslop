# Epic 05 — Core Product UI

## Goal
Build the end-to-end user experience from username input to results.

## Scope
- Home input flow
- Result route and score visualization
- Explanations and confidence display

## Out of Scope
- Leaderboard and virality mechanics

## Tasks
- [x] Build homepage with username input (`suspect` field, `Inspect the vibes` CTA)
- [x] Add loading states — investigation view with detection protocol + live stats
- [x] Build result page route `/u/[username]`
- [x] Render score gauge + tier explanation
- [x] Render signal breakdown cards (top signals with score-colored left border)
- [x] Render confidence badge + scoring window label + confidence verdict line
- [x] Add empty/error states for low/no data users (Ghost account, GitHub says chill, etc.)
- [x] Add analyzed commits pagination (20/page) + flagged-only filter toggle (`commit-list.tsx`)
- [x] Personality overhaul — rewrote all copy for voice consistency (stage labels, error states, share actions, flag labels, signal copy)

## Dependencies
- Epic 04 score API.

## Definition of Done
- User can complete full flow and understand why they got the score.
