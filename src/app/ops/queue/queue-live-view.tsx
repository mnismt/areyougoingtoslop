'use client'

import { useEffect, useRef, useState } from 'react'
import type { QueueConsumerSnapshot, QueueSnapshot } from './queue-types'

const POLL_MS = 2_000
const MAX_HISTORY_POINTS = 90

const SPARKLINE_WIDTH = 100
const SPARKLINE_HEIGHT = 64
const SPARKLINE_PADDING = 0

type HistoryPoint = { at: number; pending: number }

const isQueueSnapshot = (value: unknown): value is QueueSnapshot => {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<QueueSnapshot>
  return (
    typeof c.health === 'string' &&
    typeof c.generated_at === 'string' &&
    typeof c.enabled === 'boolean' &&
    typeof c.queue === 'object' &&
    Array.isArray(c.consumers) &&
    Array.isArray(c.warnings) &&
    Array.isArray(
      (c as { recent_usernames?: unknown }).recent_usernames ?? [],
    ) &&
    Array.isArray(
      (c as { active_score_usernames?: unknown }).active_score_usernames ?? [],
    )
  )
}

const displayName = (name: string) => {
  const base = name.replace(/^ays-gh-/, '')
  const match = base.match(/^w(\d+)$/)
  return match ? `slop-bot-${match[1]}` : base
}

const parseSnapshotMs = (timestamp: string) => {
  const parsed = new Date(timestamp).getTime()
  return Number.isNaN(parsed) ? Date.now() : parsed
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

const formatIdleMs = (ms: number) => {
  if (ms < 1_000) return `${ms}ms`
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`
  return `${Math.round(ms / 60_000)}m`
}

const buildSparklinePaths = (series: number[]) => {
  const points = series.length > 1 ? series : [series[0] ?? 0, series[0] ?? 0]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(1, max - min)
  const uw = SPARKLINE_WIDTH - SPARKLINE_PADDING * 2
  const uh = SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2

  const coords = points.map((v, i) => ({
    x: SPARKLINE_PADDING + (i / (points.length - 1)) * uw,
    y: SPARKLINE_PADDING + uh - ((v - min) / span) * uh,
  }))

  const line = coords
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')
  const lastX = coords[coords.length - 1]?.x ?? SPARKLINE_WIDTH
  const firstX = coords[0]?.x ?? 0
  const area = `${line} L ${lastX} ${SPARKLINE_HEIGHT - SPARKLINE_PADDING} L ${firstX} ${SPARKLINE_HEIGHT - SPARKLINE_PADDING} Z`

  return { line, area }
}

const consumerDotClass = (consumer: QueueConsumerSnapshot) => {
  if (consumer.pending > 0) return 'bg-rose-500'
  if (consumer.idle_ms > 5 * 60_000) return 'bg-amber-500'
  return 'bg-emerald-500/70'
}

export default function QueueLiveView() {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    const poll = async () => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        const res = await fetch('/ops/queue/snapshot', { cache: 'no-store' })
        const payload = (await res.json().catch(() => null)) as unknown
        if (!res.ok || !isQueueSnapshot(payload)) {
          setNetworkError('snapshot unavailable. probably fine. retrying...')
          return
        }
        setSnapshot(payload)
        setNetworkError(null)
        setHistory((prev) => {
          const point: HistoryPoint = {
            at: parseSnapshotMs(payload.generated_at),
            pending: payload.queue.pending,
          }
          const last = prev[prev.length - 1]
          const next =
            last?.at === point.at
              ? [...prev.slice(0, -1), point]
              : [...prev, point]
          return next.slice(-MAX_HISTORY_POINTS)
        })
      } catch {
        setNetworkError('snapshot unavailable. probably fine. retrying...')
      } finally {
        inFlightRef.current = false
      }
    }

    pollingRef.current = setInterval(() => void poll(), POLL_MS)
    void poll()
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  if (!snapshot) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-8 w-64 rounded bg-muted/40" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/30" />
          ))}
        </div>
        <div className="h-20 rounded-xl bg-muted/20" />
      </div>
    )
  }

  if (!snapshot.enabled) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="rounded-xl border border-border/60 bg-card px-8 py-10 text-center">
          <p className="font-mono text-sm text-muted-foreground">
            queue mode is disabled. set{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              REDIS_URL
            </code>{' '}
            to enable. or don't. the app mostly works without it.
          </p>
        </div>
      </div>
    )
  }

  const { health, queue, consumers, warnings, generated_at } = snapshot

  const dotColor =
    health === 'ok'
      ? 'bg-emerald-500'
      : health === 'degraded'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/50'
  const healthLabel =
    health === 'ok'
      ? 'live · ok'
      : health === 'degraded'
        ? 'live · degraded'
        : 'disabled'

  const pendingSeries = history.length
    ? history.map((p) => p.pending)
    : [queue.pending]
  const { line: sparkLine, area: sparkArea } =
    buildSparklinePaths(pendingSeries)

  return (
    <div className="flex flex-col gap-5 animate-rise">
      {/* Status row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor} animate-pulse`}
            aria-hidden="true"
          />
          <span className="font-mono text-sm font-semibold tracking-widest text-foreground">
            {healthLabel}
          </span>
          {networkError && (
            <span className="ml-2 font-mono text-xs text-amber-500">
              {networkError}
            </span>
          )}
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          last seen alive {formatTime(generated_at)}
        </span>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'pending',
            value: queue.pending,
            hint: 'claimed, not yet dealt with',
          },
          {
            label: 'delayed',
            value: queue.delayed,
            hint: 'failed once, trying again later',
          },
          {
            label: 'workers',
            value: `${queue.active_consumers} / ${queue.workers_configured}`,
            hint: 'online / configured',
          },
          {
            label: 'lag',
            value: queue.lag ?? 0,
            hint: "entries the world hasn't seen yet",
          },
        ].map(({ label, value, hint }) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-xl bg-card px-4 py-3 ring-1 ring-border/50"
          >
            <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {value}
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-widest text-muted-foreground">
              {label}
            </span>
            <span className="text-[11px] text-muted-foreground/70">{hint}</span>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-border/50">
        <svg
          width="100%"
          height={SPARKLINE_HEIGHT}
          viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="pending jobs sparkline — last 3 minutes"
        >
          <path d={sparkArea} className="fill-amber-500/10" />
          <path
            d={sparkLine}
            className="fill-none stroke-amber-500/80 stroke-2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground/60">
          pending · last 3 min (yes, we're still watching)
        </p>
      </div>

      {/* Scoring now */}
      {snapshot.active_score_usernames.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] font-semibold tracking-widest text-muted-foreground">
            scoring now
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {snapshot.active_score_usernames.map((username) => (
              <a
                key={username}
                href={`/u/${username}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/20"
              >
                <img
                  src={`https://github.com/${username}.png?size=20`}
                  alt=""
                  className="h-5 w-5 rounded-full"
                  aria-hidden="true"
                />
                @{username}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Queue preview */}
      {snapshot.recent_usernames.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] font-semibold tracking-widest text-muted-foreground">
            recently queued
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {snapshot.recent_usernames.map((username) => (
              <a
                key={username}
                href={`/u/${username}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <img
                  src={`https://github.com/${username}.png?size=20`}
                  alt=""
                  className="h-5 w-5 rounded-full"
                  aria-hidden="true"
                />
                @{username}
              </a>
            ))}
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/50">
            next in line · {queue.lag ?? 0} undelivered
          </p>
        </div>
      )}

      {/* Workers */}
      <div>
        {consumers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            no active consumers. queue is enjoying the quiet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {consumers.map((consumer) => (
              <div
                key={consumer.name}
                className="min-w-[180px] rounded-lg bg-muted/50 px-3 py-2 ring-1 ring-border/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${consumerDotClass(consumer)}`}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {displayName(consumer.name)}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground/60">
                    idle {formatIdleMs(consumer.idle_ms)}
                  </span>
                </div>
                {consumer.current_usernames.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {consumer.current_usernames.map((username) => (
                      <a
                        key={username}
                        href={`/u/${username}`}
                        className="inline-flex items-center gap-1 rounded-full bg-background/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <img
                          src={`https://github.com/${username}.png?size=20`}
                          alt=""
                          className="h-4 w-4 rounded-full"
                          aria-hidden="true"
                        />
                        @{username}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <ul className="space-y-1 text-sm text-amber-500">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
