#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'
import Redis from 'ioredis'

type LeaderboardEntry = {
  username: string
  slop_score: number
  tier: string
  tier_tagline?: string
  confidence: 'low' | 'medium' | 'high'
  last_scored_at: string
}

type LeaderboardState = {
  entries: LeaderboardEntry[]
}

const LEADERBOARD_KEY = 'ays:leaderboard:v1:state'

const getRedisUrl = (): string | null => {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) {
    return null
  }
  return redisUrl
}

const loadSourceFile = async (filePath: string): Promise<LeaderboardState> => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as LeaderboardState
    if (!parsed || !Array.isArray(parsed.entries)) {
      console.warn('Source file has invalid format, starting fresh')
      return { entries: [] }
    }
    return parsed
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      console.log('Source file not found:', filePath)
      return { entries: [] }
    }
    throw err
  }
}

const main = async () => {
  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    console.error('Error: REDIS_URL environment variable is not set')
    process.exit(1)
  }

  const sourcePath =
    process.env.LEADERBOARD_MIGRATE_SOURCE ?? '.data/leaderboard.json'
  const resolvedPath = path.resolve(sourcePath)

  console.log('Leaderboard Migration Tool')
  console.log('==========================')
  console.log(`Source file: ${resolvedPath}`)
  console.log(
    `Redis URL: ${redisUrl.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2')}`,
  )
  console.log(`Target key: ${LEADERBOARD_KEY}`)
  console.log()

  const state = await loadSourceFile(resolvedPath)
  console.log(`Loaded ${state.entries.length} entries from source file`)

  if (state.entries.length === 0) {
    console.log('No entries to migrate. Exiting.')
    process.exit(0)
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  })

  try {
    // Check if key already exists
    const existing = await redis.get(LEADERBOARD_KEY)
    if (existing) {
      console.log()
      console.log('Warning: Leaderboard key already exists in Redis.')
      console.log('Run with LEADERBOARD_MIGRATE_FORCE=1 to overwrite.')
      console.log()
      console.log('Existing data preview (first 3 entries):')
      const existingState = JSON.parse(existing) as LeaderboardState
      existingState.entries.slice(0, 3).forEach((entry) => {
        console.log(
          `  - ${entry.username}: ${entry.slop_score} (${entry.confidence})`,
        )
      })
      if (existingState.entries.length > 3) {
        console.log(`  ... and ${existingState.entries.length - 3} more`)
      }

      if (process.env.LEADERBOARD_MIGRATE_FORCE !== '1') {
        console.log()
        console.log(
          'Migration aborted. Use LEADERBOARD_MIGRATE_FORCE=1 to force overwrite.',
        )
        process.exit(1)
      }

      console.log()
      console.log(
        'LEADERBOARD_MIGRATE_FORCE is set. Overwriting existing data...',
      )
    }

    // Write to Redis
    await redis.set(LEADERBOARD_KEY, JSON.stringify(state))
    console.log(
      `Successfully migrated ${state.entries.length} entries to Redis`,
    )

    // Verify
    const verify = await redis.get(LEADERBOARD_KEY)
    if (verify) {
      const verifyState = JSON.parse(verify) as LeaderboardState
      console.log(
        `Verification: ${verifyState.entries.length} entries in Redis`,
      )

      if (verifyState.entries.length !== state.entries.length) {
        console.error('Error: Entry count mismatch after migration!')
        process.exit(1)
      }
    }

    console.log()
    console.log('Migration complete!')
    console.log()
    console.log('Next steps:')
    console.log(
      '  1. Verify the leaderboard at /leaderboard and /api/leaderboard',
    )
    console.log('  2. Remove or archive the old file:', resolvedPath)
    console.log(
      '  3. Update LEADERBOARD_STORAGE_PATH env var if you want to keep it for reference',
    )
    console.log(
      '  4. Consider backing up Redis data regularly (ays:leaderboard:v1:state)',
    )
  } finally {
    await redis.quit()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
