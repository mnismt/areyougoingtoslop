// Cloudflare bindings adapter. Nothing in src imports 'cloudflare:workers': worker/index.ts
// calls setEnv(env) on every fetch()/queue() invocation, and node tests call
// setEnv(createFakeEnv().env). Strings (GITHUB_TOKEN, OPS_TOKEN) stay on process.env.
// Hand-written structural types: @cloudflare/workers-types globals collide with lib.dom.

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes: number } }>
}

export type D1Database = {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>
}

export type KVNamespace = {
  get(key: string, type: 'json'): Promise<unknown>
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
  put(
    key: string,
    value: string | ArrayBuffer,
    options?: { expirationTtl?: number },
  ): Promise<void>
  delete(key: string): Promise<void>
}

export type ScoreJobMessage = { job_id: string; username: string }

export type AppEnv = {
  DB: D1Database
  CACHE: KVNamespace
  SCORE_QUEUE: { send(body: ScoreJobMessage): Promise<void> }
}

let current: AppEnv | null = null

export const setEnv = (env: AppEnv | null) => {
  current = env
}

export const hasEnv = () => current !== null

export const getEnv = (): AppEnv => {
  if (!current) throw new Error('cloudflare_env_not_initialized')
  return current
}
