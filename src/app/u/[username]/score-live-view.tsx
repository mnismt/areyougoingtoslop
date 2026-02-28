'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import SlopGauge from '@/app/components/slop-gauge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CommitList from './commit-list'
import ShareActions from './share-actions'

export type AnalyzedCommit = {
  sha: string
  repo: string
  message: string
  occurred_at: string
  additions?: number
  deletions?: number
  flags: string[]
}

type ScoreResponse = {
  slop_score: number
  tier: string
  confidence: 'low' | 'medium' | 'high'
  top_signals: string[]
  scoring_window: string
  analyzed_commits: AnalyzedCommit[]
}

type ScoreCoverage = {
  commits_discovered: number
  commits_enriched: number
  repos_scanned: number
  repos_total: number
  window_days: number
  is_partial: boolean
  sources_used: string[]
}

type ScoreLimits = {
  rate_limited: boolean
  events_pagination_limited: boolean
}

type ScoreJobSnapshot = {
  job_id: string
  username: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  stage: 'queued' | 'discovering' | 'enriching' | 'finalizing'
  progress_percent: number
  result: ScoreResponse | null
  coverage: ScoreCoverage
  limits: ScoreLimits
  error: {
    code: 'invalid_username' | 'not_found' | 'rate_limited' | 'server_error'
    message: string
    reset_at?: string
  } | null
}

type ScoreJobErrorPayload = {
  error: 'invalid_username' | 'not_found' | 'rate_limited' | 'server_error'
  message: string
  reset_at?: string
}

const POLL_MS = 1200

const stageLabel: Record<ScoreJobSnapshot['stage'], string> = {
  queued: 'Queued',
  discovering: 'Discovering commits',
  enriching: 'Enriching commit stats',
  finalizing: 'Finalizing score',
}

const confidenceStyles: Record<ScoreResponse['confidence'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-accent-soft text-primary',
}

const scoreColorClass = (score: number) => {
  if (score <= 30) return 'border-score-low'
  if (score <= 70) return 'border-score-mid'
  return 'border-score-high'
}

const ErrorState = ({
  title,
  description,
}: {
  title: string
  description: string
}) => (
  <div className="rounded-xl border border-border bg-card p-8 text-left">
    <p className="font-mono text-xs text-muted-foreground">{title}</p>
    <p className="mt-4 text-sm text-muted-foreground">{description}</p>
    <Button variant="outline" asChild className="mt-6 font-mono text-xs">
      <Link href="/">Try another</Link>
    </Button>
  </div>
)

const LoadingCards = () => {
  return (
    <>
      <section className="rounded-xl border border-border bg-card p-8 animate-rise">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-center">
          <Skeleton className="h-44 w-full max-w-[220px] rounded-xl" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {['one', 'two', 'three'].map((slot) => (
          <Skeleton
            key={`signal-skeleton-${slot}`}
            className="h-24 rounded-xl"
          />
        ))}
      </section>
    </>
  )
}

const mapErrorToState = (snapshot: ScoreJobSnapshot | null) => {
  if (!snapshot || snapshot.status !== 'failed' || !snapshot.error) {
    return null
  }

  if (snapshot.error.code === 'not_found') {
    return {
      title: 'User not found',
      description:
        "We couldn't find that GitHub account. Double-check the spelling and try again.",
    }
  }

  if (snapshot.error.code === 'rate_limited') {
    return {
      title: 'Rate limited',
      description:
        'GitHub asked us to slow down. Give it a minute and re-run the score.',
    }
  }

  if (snapshot.error.code === 'invalid_username') {
    return {
      title: 'Invalid username',
      description: 'That does not look like a valid GitHub username.',
    }
  }

  return {
    title: 'Score unavailable',
    description: 'We could not compute a score right now. Try again later.',
  }
}

const toFailedSnapshot = (
  username: string,
  payload: ScoreJobErrorPayload,
): ScoreJobSnapshot => ({
  job_id: 'error',
  username,
  status: 'failed',
  stage: 'finalizing',
  progress_percent: 100,
  result: null,
  coverage: {
    commits_discovered: 0,
    commits_enriched: 0,
    repos_scanned: 0,
    repos_total: 0,
    window_days: 180,
    is_partial: true,
    sources_used: [],
  },
  limits: {
    rate_limited: payload.error === 'rate_limited',
    events_pagination_limited: false,
  },
  error: {
    code: payload.error,
    message: payload.message,
    reset_at: payload.reset_at,
  },
})

const isScoreJobErrorPayload = (
  payload: ScoreJobSnapshot | ScoreJobErrorPayload,
): payload is ScoreJobErrorPayload => {
  return typeof (payload as ScoreJobErrorPayload).error === 'string'
}

const JobProgress = ({ snapshot }: { snapshot: ScoreJobSnapshot }) => {
  return (
    <section className="rounded-xl border border-border bg-card p-5 animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted-foreground">
          {stageLabel[snapshot.stage]}
        </p>
        <Badge variant="outline" className="font-mono text-[10px]">
          {snapshot.progress_percent}%
        </Badge>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(4, snapshot.progress_percent)}%` }}
        />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p className="font-mono">
          commits enriched {snapshot.coverage.commits_enriched}/
          {snapshot.coverage.commits_discovered}
        </p>
        <p className="font-mono">
          repos scanned {snapshot.coverage.repos_scanned}/
          {snapshot.coverage.repos_total}
        </p>
        <p className="font-mono">window {snapshot.coverage.window_days} days</p>
        <p className="font-mono">
          sources{' '}
          {snapshot.coverage.sources_used.length > 0
            ? snapshot.coverage.sources_used.join(', ')
            : 'warming up'}
        </p>
      </div>

      {snapshot.coverage.is_partial ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Partial snapshot. We keep improving this score while data comes in.
        </p>
      ) : null}

      {snapshot.limits.events_pagination_limited ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Events pagination was limited for this user. We used repository commit
          enumeration to recover more history.
        </p>
      ) : null}

      {snapshot.limits.rate_limited ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Hit GitHub rate limits while scanning. Final coverage may be lower
          than ideal.
        </p>
      ) : null}
    </section>
  )
}

export default function ScoreLiveView({ username }: { username: string }) {
  const [snapshot, setSnapshot] = useState<ScoreJobSnapshot | null>(null)
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

    const pollJob = async (jobId: string) => {
      if (inFlightRef.current) {
        return
      }

      inFlightRef.current = true
      try {
        const response = await fetch(`/api/score/jobs/${jobId}`, {
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => null)) as
          | ScoreJobSnapshot
          | ScoreJobErrorPayload
          | null

        if (!response.ok) {
          if (payload && isScoreJobErrorPayload(payload)) {
            setSnapshot(toFailedSnapshot(username, payload))
            stopPolling()
            return
          }
          setNetworkError('Unable to fetch score progress. Please refresh.')
          stopPolling()
          return
        }

        if (!payload || !('job_id' in payload)) {
          setNetworkError('Unable to fetch score progress. Please refresh.')
          stopPolling()
          return
        }

        setSnapshot(payload)

        if (payload.status === 'completed' || payload.status === 'failed') {
          stopPolling()
        }
      } catch {
        setNetworkError('Unable to fetch score progress. Please refresh.')
        stopPolling()
      } finally {
        inFlightRef.current = false
      }
    }

    const start = async () => {
      setNetworkError(null)
      stopPolling()

      try {
        const response = await fetch(`/api/score/${username}/jobs`, {
          method: 'POST',
          cache: 'no-store',
        })

        const payload = (await response.json().catch(() => null)) as
          | ScoreJobSnapshot
          | ScoreJobErrorPayload
          | null

        if (!response.ok) {
          if (payload && isScoreJobErrorPayload(payload)) {
            setSnapshot(toFailedSnapshot(username, payload))
            return
          }
          setNetworkError('Unable to start score job. Please try again.')
          return
        }

        if (!payload || !('job_id' in payload)) {
          setNetworkError('Unable to start score job. Please try again.')
          return
        }

        setSnapshot(payload)

        if (payload.status === 'completed' || payload.status === 'failed') {
          return
        }

        pollingRef.current = setInterval(() => {
          void pollJob(payload.job_id)
        }, POLL_MS)

        void pollJob(payload.job_id)
      } catch {
        setNetworkError('Unable to start score job. Please try again.')
      }
    }

    void start()

    return () => {
      stopPolling()
    }
  }, [username])

  const mappedError = mapErrorToState(snapshot)
  if (mappedError) {
    return (
      <ErrorState
        title={mappedError.title}
        description={mappedError.description}
      />
    )
  }

  if (networkError) {
    return <ErrorState title="Network hiccup" description={networkError} />
  }

  const data = snapshot?.result
  const hasLowSignal = data?.top_signals.some((signal) =>
    signal.toLowerCase().includes('low signal'),
  )

  return (
    <>
      {snapshot ? <JobProgress snapshot={snapshot} /> : null}

      {!data ? (
        <LoadingCards />
      ) : (
        <>
          <section
            id="share-card"
            className="flex flex-col gap-8 rounded-xl border border-border bg-card p-8 animate-rise"
          >
            <div className="flex items-center gap-4">
              <Image
                src={`https://github.com/${username}.png`}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 rounded-full bg-muted"
                unoptimized
              />
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold sm:text-3xl">@{username}</h1>
                <p className="font-mono text-sm text-muted-foreground">
                  {data.tier}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-8 md:flex-row">
              <SlopGauge score={data.slop_score} />
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className={`rounded-lg px-3 py-1 font-mono text-xs ${confidenceStyles[data.confidence]}`}
                  >
                    {data.confidence} confidence
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-lg px-3 py-1 font-mono text-xs text-muted-foreground"
                  >
                    {data.scoring_window}
                  </Badge>
                  {snapshot?.coverage.is_partial ? (
                    <Badge
                      variant="outline"
                      className="rounded-lg px-3 py-1 font-mono text-xs"
                    >
                      partial
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Confidence reflects the volume of recent public activity and
                  the amount of commit stats we can verify.
                </p>
                <p className="text-sm text-muted-foreground">
                  We rank the surface-level signals in public activity. The
                  score is a playful heuristic, not a definitive detector.
                </p>
                {hasLowSignal ? (
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                    Not enough recent activity to lean on. Try again after a few
                    public commits.
                  </div>
                ) : null}
                <ShareActions username={username} />
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {data.top_signals.map((signal) => (
              <div
                key={signal}
                className={`rounded-xl border border-border border-l-4 ${scoreColorClass(data.slop_score)} bg-card p-5 text-sm text-muted-foreground animate-rise animate-delay-1`}
              >
                {signal}
              </div>
            ))}
          </section>

          {data.analyzed_commits.length > 0 && (
            <CommitList commits={data.analyzed_commits} />
          )}
        </>
      )}

      <p className="text-center font-mono text-xs text-muted-foreground">
        Satirical heuristic, not proof. Roast the behavior, not the person.
      </p>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
        <span>Built for screenshots, not courtrooms.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/feedback" className="hover:text-foreground">
            Feedback
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </footer>
    </>
  )
}
