// In-memory Cloudflare bindings for node tests. DB runs the real migrations on node:sqlite.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { AppEnv, D1PreparedStatement, ScoreJobMessage } from '../env'

type Bound = D1PreparedStatement & { sql: string; values: SQLInputValue[] }

const plain = <T>(row: unknown) => (row ? ({ ...(row as object) } as T) : null)

const createFakeDb = () => {
  const db = new DatabaseSync(':memory:')
  const dir = join(process.cwd(), 'migrations')
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    db.exec(readFileSync(join(dir, file), 'utf8'))
  }

  const exec = (sql: string, values: SQLInputValue[]) => {
    const stmt = db.prepare(sql)
    if (stmt.columns().length > 0) {
      const results = stmt
        .all(...values)
        .map((row) => plain<Record<string, unknown>>(row))
      return { results, meta: { changes: results.length } }
    }
    return {
      results: [],
      meta: { changes: Number(stmt.run(...values).changes) },
    }
  }

  const statement = (sql: string, values: SQLInputValue[]): Bound => ({
    sql,
    values,
    bind: (...next: unknown[]) => statement(sql, next as SQLInputValue[]),
    first: async <T>() => plain<T>(db.prepare(sql).get(...values)),
    all: async <T>() => ({ results: exec(sql, values).results as T[] }),
    run: async () => ({ meta: exec(sql, values).meta }),
  })

  return {
    prepare: (sql: string) => statement(sql, []),
    batch: async (statements: D1PreparedStatement[]) => {
      db.exec('BEGIN')
      try {
        const out = (statements as Bound[]).map((s) => exec(s.sql, s.values))
        db.exec('COMMIT')
        return out
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}

const createFakeKv = () => {
  const store = new Map<
    string,
    { value: string | ArrayBuffer; expiresAt: number | null }
  >()
  const read = (key: string) => {
    const entry = store.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      store.delete(key)
      return null
    }
    return entry.value
  }
  return {
    get: (async (key: string, type: 'json' | 'arrayBuffer') => {
      const value = read(key)
      if (value === null) return null
      if (type === 'json')
        return JSON.parse(
          typeof value === 'string' ? value : new TextDecoder().decode(value),
        )
      return typeof value === 'string'
        ? new TextEncoder().encode(value).buffer
        : value
    }) as AppEnv['CACHE']['get'],
    put: async (
      key: string,
      value: string | ArrayBuffer,
      options?: { expirationTtl?: number },
    ) => {
      const ttl = options?.expirationTtl
      if (ttl !== undefined && ttl < 60)
        throw new Error('KV expirationTtl must be at least 60 seconds')
      store.set(key, {
        value,
        expiresAt: ttl === undefined ? null : Date.now() + ttl * 1000,
      })
    },
    delete: async (key: string) => {
      store.delete(key)
    },
  }
}

export const createFakeEnv = (): { env: AppEnv; sent: ScoreJobMessage[] } => {
  const sent: ScoreJobMessage[] = []
  return {
    sent,
    env: {
      DB: createFakeDb(),
      CACHE: createFakeKv(),
      SCORE_QUEUE: {
        send: async (body) => {
          sent.push(body)
        },
      },
    },
  }
}
