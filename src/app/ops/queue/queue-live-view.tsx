'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type QueueConsumerSnapshot = {
  name: string
  pending: number
  idle_ms: number
  inactive_ms: number | null
}

type QueueSnapshot = {
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
}

const POLL_MS = 2_000

const healthStyle: Record<QueueSnapshot['health'], string> = {
  disabled: 'bg-muted text-muted-foreground',
  ok: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  degraded: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}

const formatInteger = (value: number | null) => {
  if (value === null) {
    return '--'
  }

  return new Intl.NumberFormat('en-US').format(value)
}

const formatDurationMs = (value: number | null) => {
  if (value === null) {
    return '--'
  }

  if (value < 1_000) {
    return `${value}ms`
  }

  const seconds = Math.round(value / 100) / 10
  return `${seconds}s`
}

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return '--'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

const isQueueSnapshot = (value: unknown): value is QueueSnapshot => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<QueueSnapshot>
  return (
    typeof candidate.health === 'string' &&
    typeof candidate.generated_at === 'string' &&
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.queue === 'object' &&
    Array.isArray(candidate.consumers) &&
    Array.isArray(candidate.warnings)
  )
}

export default function QueueLiveView() {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    const stopPolling = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      inFlightRef.current = false
    }

    const pollSnapshot = async () => {
      if (inFlightRef.current) {
        return
      }

      inFlightRef.current = true

      try {
        const response = await fetch('/api/queue/github', {
          cache: 'no-store',
        })
        const payload = (await response
          .json()
          .catch(() => null)) as QueueSnapshot | null

        if (!response.ok || !payload || !isQueueSnapshot(payload)) {
          setNetworkError('Queue snapshot unavailable. Retrying...')
          return
        }

        setSnapshot(payload)
        setNetworkError(null)
      } catch {
        setNetworkError('Queue snapshot unavailable. Retrying...')
      } finally {
        inFlightRef.current = false
      }
    }

    pollingRef.current = setInterval(() => {
      void pollSnapshot()
    }, POLL_MS)
    void pollSnapshot()

    return () => {
      stopPolling()
    }
  }, [])

  if (!snapshot) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        {networkError ? (
          <p className="text-sm text-muted-foreground">{networkError}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 animate-rise">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-xl">GitHub Queue Status</CardTitle>
            <Badge className={healthStyle[snapshot.health]}>
              {snapshot.health}
            </Badge>
          </div>
          <CardDescription className="font-mono text-xs">
            refreshed {formatTimestamp(snapshot.generated_at)} &middot; polling
            every {Math.round(POLL_MS / 1000)}s
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p>
            stream initialized:{' '}
            {snapshot.queue.stream_initialized ? 'yes' : 'no'}
          </p>
          <p>
            workers online {snapshot.queue.active_consumers}/
            {snapshot.queue.workers_configured}
          </p>
          {networkError ? <p>{networkError}</p> : null}
          {snapshot.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="font-mono text-xs">lag</CardDescription>
            <CardTitle className="text-3xl">
              {formatInteger(snapshot.queue.lag)}
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground">
            undelivered stream entries
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="font-mono text-xs">
              pending
            </CardDescription>
            <CardTitle className="text-3xl">
              {formatInteger(snapshot.queue.pending)}
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground">
            claimed but not acked
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="font-mono text-xs">
              delayed retries
            </CardDescription>
            <CardTitle className="text-3xl">
              {formatInteger(snapshot.queue.delayed)}
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground">
            next retry in {formatDurationMs(snapshot.queue.next_retry_in_ms)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="font-mono text-xs">
              processed
            </CardDescription>
            <CardTitle className="text-3xl">
              {formatInteger(snapshot.queue.processed_entries)}
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground">
            entries read by worker group
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Worker Consumers</CardTitle>
          <CardDescription className="font-mono text-xs">
            {snapshot.consumers.length} active consumer
            {snapshot.consumers.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot.consumers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active consumers yet. Submit a score job to warm the queue.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border font-mono text-xs text-muted-foreground">
                    <th className="py-2 text-left font-medium">consumer</th>
                    <th className="py-2 text-left font-medium">pending</th>
                    <th className="py-2 text-left font-medium">idle</th>
                    <th className="py-2 text-left font-medium">inactive</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.consumers.map((consumer) => (
                    <tr
                      key={consumer.name}
                      className="border-b border-border/70"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                        {consumer.name}
                      </td>
                      <td className="py-2 pr-4">
                        {formatInteger(consumer.pending)}
                      </td>
                      <td className="py-2 pr-4">
                        {formatDurationMs(consumer.idle_ms)}
                      </td>
                      <td className="py-2 pr-4">
                        {formatDurationMs(consumer.inactive_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
