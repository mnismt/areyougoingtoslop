/**
 * One-off import of the old Redis wall of shame into D1. No Redis client needed.
 *
 *   redis-cli --raw GET ays:leaderboard:v1:state > lb.json
 *   redis-cli --raw GET ays:leaderboard:v1:unique-count   # -> <uniqueCount>
 *   bun run scripts/leaderboard-json-to-sql.ts lb.json <uniqueCount> > lb.sql
 *   bunx wrangler d1 execute DB --remote --file lb.sql
 */
import { readFileSync } from 'node:fs'
import type { LeaderboardEntry } from '../src/server/leaderboard/types'

const [file, uniqueCountArg] = process.argv.slice(2)
if (!file) {
  console.error(
    'usage: bun run scripts/leaderboard-json-to-sql.ts lb.json [uniqueCount]',
  )
  process.exit(1)
}

const sql = (value: string | number | null | undefined) =>
  value == null
    ? 'NULL'
    : typeof value === 'number'
      ? String(Math.trunc(value))
      : `'${value.replaceAll("'", "''")}'`

const { entries } = JSON.parse(readFileSync(file, 'utf8')) as {
  entries: LeaderboardEntry[]
}

for (const e of entries) {
  console.log(
    `INSERT OR REPLACE INTO leaderboard (username_key, username, slop_score, tier, tier_tagline, confidence, last_scored_at) VALUES (${[
      e.username.toLowerCase(),
      e.username,
      e.slop_score,
      e.tier,
      e.tier_tagline,
      e.confidence,
      e.last_scored_at,
    ]
      .map(sql)
      .join(', ')});`,
  )
}

const uniqueCount = Math.max(Number(uniqueCountArg) || 0, entries.length)
console.log(
  `INSERT OR REPLACE INTO counters (name, value) VALUES ('leaderboard_unique', ${uniqueCount});`,
)
