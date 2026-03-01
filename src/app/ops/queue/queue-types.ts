export type QueueConsumerSnapshot = {
  name: string
  pending: number
  idle_ms: number
  inactive_ms: number | null
  current_usernames: string[]
}

export type QueueSnapshot = {
  enabled: boolean
  health: 'disabled' | 'ok' | 'degraded'
  generated_at: string
  warnings: string[]
  queue: {
    workers_configured: number
    stream_initialized: boolean
    lag: number | null
    pending: number
    delayed: number
    active_consumers: number
    processed_entries: number | null
    next_retry_at: string | null
    next_retry_in_ms: number | null
  }
  consumers: QueueConsumerSnapshot[]
  recent_usernames: string[]
  active_score_usernames: string[]
}
