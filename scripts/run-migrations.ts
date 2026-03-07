#!/usr/bin/env node
/**
 * Runs all migration scripts in scripts/migrations/ in lexicographic order.
 *
 * Each migration exports a default function: (redis: Redis) => Promise<result>.
 * Migrations must be idempotent — this runner executes on every container start.
 *
 * Usage:
 *   REDIS_URL=redis://... bun run scripts/run-migrations.ts
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import Redis from 'ioredis'

const main = async () => {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) {
    console.warn('[migrations] REDIS_URL not set, skipping')
    return
  }

  const migrationsDir = join(import.meta.dirname, 'migrations')
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort()

  if (files.length === 0) {
    console.log('[migrations] no migrations found')
    return
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  })

  try {
    for (const file of files) {
      const mod = await import(join(migrationsDir, file))
      const migrate = mod.default
      if (typeof migrate !== 'function') {
        console.warn(`[migrations] ${file}: no default export, skipping`)
        continue
      }
      try {
        const result = await migrate(redis)
        if (result?.skipped) {
          console.log(`[migrations] ${file}: skipped — ${result.reason}`)
        } else {
          console.log(`[migrations] ${file}: done — ${result?.result ?? 'ok'}`)
        }
      } catch (err) {
        console.error(`[migrations] ${file}: FAILED`, err)
        process.exit(1)
      }
    }
  } finally {
    await redis.quit()
  }
}

main().catch((err) => {
  console.error('[migrations] runner failed:', err)
  process.exit(1)
})
