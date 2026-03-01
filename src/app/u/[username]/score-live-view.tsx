'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { SiteFooter } from '@/app/components/site-footer'
import SlopGauge from '@/app/components/slop-gauge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
    code:
      | 'invalid_username'
      | 'not_found'
      | 'job_not_found'
      | 'rate_limited'
      | 'server_error'
    message: string
    reset_at?: string
  } | null
}

type ScoreJobErrorPayload = {
  error:
    | 'invalid_username'
    | 'not_found'
    | 'job_not_found'
    | 'rate_limited'
    | 'server_error'
  message: string
  reset_at?: string
}

const POLL_MS = 1200

const stageLabel: Record<ScoreJobSnapshot['stage'], string> = {
  queued: 'Waiting in line...',
  discovering: 'Digging through the evidence...',
  enriching: 'Cross-referencing the receipts...',
  finalizing: 'Preparing the verdict',
}

const confidenceStyles: Record<ScoreResponse['confidence'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-accent-soft text-primary',
}

const confidenceLine: Record<ScoreResponse['confidence'], string> = {
  low: 'Not much to go on. More of a guess than a verdict.',
  medium: "Decent evidence. We're fairly confident in this roast.",
  high: 'Plenty of receipts. This score has teeth.',
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
      <Link href="/">Snitch on someone else</Link>
    </Button>
  </div>
)

const detectionSteps = [
  'Scanning for AI attribution hints',
  'Hunting for prompt crumbs left behind',
  'Measuring velocity spikes and timing',
  'Flagging massive diffs with lazy messages',
  'Detecting generate-paste-pray churn',
]

const InvestigationView = ({ snapshot }: { snapshot: ScoreJobSnapshot }) => {
  const { stage, progress_percent: progress } = snapshot

  let checkedCount = 0
  let hasActiveStep = false

  if (stage === 'queued') {
    checkedCount = 0
    hasActiveStep = false
  } else if (stage === 'discovering') {
    checkedCount = 0
    hasActiveStep = true
  } else if (stage === 'enriching') {
    const normalized = Math.max(0, progress - 20) / 65
    checkedCount = Math.min(
      Math.floor(normalized * detectionSteps.length),
      detectionSteps.length - 1,
    )
    hasActiveStep = true
  } else {
    checkedCount = detectionSteps.length
    hasActiveStep = false
  }

  const MiniProgress = ({ snapshot }: { snapshot: ScoreJobSnapshot }) => {
    const { stage, progress_percent: progress } = snapshot

    return (
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 rounded-xl border border-border bg-card/95 backdrop-blur-sm p-3 shadow-lg animate-rise">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-muted-foreground">
            {stageLabel[stage]}
          </span>
          <span className="font-mono text-xs font-bold text-primary">
            {progress}%
          </span>
        </div>
        <div className="h-1 w-32 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(3, progress)}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden animate-rise">
      {/* progress header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted-foreground">
            {stageLabel[stage]}
          </p>
          <Badge variant="outline" className="font-mono text-[10px]">
            {progress}%
          </Badge>
        </div>
        <div
          className="mt-3 h-1.5 w-full rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Investigation progress: ${progress}%`}
        >
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(3, progress)}%` }}
          />
        </div>
      </div>

      {/* detection protocol */}
      <div className="px-6 py-5">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          detection protocol
        </p>
        <div className="flex flex-col gap-3">
          {detectionSteps.map((step, i) => {
            const isDone = i < checkedCount
            const isActive = hasActiveStep && i === checkedCount

            return (
              <div
                key={step}
                className={`flex items-center gap-3 font-mono text-xs transition-all duration-500 ${
                  isDone || isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground/30'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-500 ${
                    isDone
                      ? 'bg-primary'
                      : isActive
                        ? 'bg-primary animate-pulse'
                        : 'bg-muted-foreground/20'
                  }`}
                />
                <span>{step}</span>
                {isDone ? (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    clear
                  </span>
                ) : null}
                {isActive ? (
                  <span className="ml-auto text-[10px] text-primary animate-pulse">
                    scanning
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* live stats */}
      <div className="border-t border-border px-6 py-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <p className="font-mono text-[10px] text-muted-foreground">
            <span className="text-xs font-bold text-foreground">
              {snapshot.coverage.commits_enriched}
            </span>
            /{snapshot.coverage.commits_discovered} commits
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            <span className="text-xs font-bold text-foreground">
              {snapshot.coverage.repos_scanned}
            </span>
            /{snapshot.coverage.repos_total} repos
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            <span className="text-xs font-bold text-foreground">
              {snapshot.coverage.window_days}d
            </span>{' '}
            window
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {snapshot.coverage.sources_used.length > 0 ? (
              <>
                <span className="text-xs font-bold text-foreground">
                  {snapshot.coverage.sources_used.length}
                </span>{' '}
                intel{' '}
                {snapshot.coverage.sources_used.length === 1
                  ? 'source'
                  : 'sources'}
              </>
            ) : (
              'sources warming up'
            )}
          </p>
        </div>

        {snapshot.coverage.is_partial ? (
          <p className="mt-3 font-mono text-[10px] text-muted-foreground">
            Partial snapshot. The investigation continues.
          </p>
        ) : null}
        {snapshot.limits.rate_limited ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            GitHub told us to slow down. We complied, reluctantly.
          </p>
        ) : null}
        {snapshot.limits.events_pagination_limited ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            GitHub tried to hide some history. We found it anyway.
          </p>
        ) : null}
      </div>
    </section>
  )
}

const MiniProgress = ({ snapshot }: { snapshot: ScoreJobSnapshot }) => {
  const { stage, progress_percent: progress } = snapshot
  const [isExpanded, setIsExpanded] = useState(true)
  const isComplete = progress >= 100

  // Colors based on completion status
  const progressColor = isComplete ? 'bg-green-500' : 'bg-primary'
  const textColor = isComplete ? 'text-green-500' : 'text-primary'

  // Calculate which steps are done/active (same logic as InvestigationView)
  let checkedCount = 0
  let hasActiveStep = false

  if (stage === 'queued') {
    checkedCount = 0
    hasActiveStep = false
  } else if (stage === 'discovering') {
    checkedCount = 0
    hasActiveStep = true
  } else if (stage === 'enriching') {
    const normalized = Math.max(0, progress - 20) / 65
    checkedCount = Math.min(
      Math.floor(normalized * detectionSteps.length),
      detectionSteps.length - 1,
    )
    hasActiveStep = true
  } else {
    checkedCount = detectionSteps.length
    hasActiveStep = false
  }

  // Collapsed view - compact pill
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="fixed top-24 right-4 z-[9999] flex items-center gap-3 rounded-full border border-border bg-card/95 backdrop-blur-md px-4 py-2 shadow-lg hover:bg-card transition-colors animate-rise"
        aria-label="Expand progress details"
      >
        <div className="flex flex-col items-start">
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {isComplete ? 'Investigation Complete' : 'Investigating...'}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${progressColor} transition-all duration-1000`}
                style={{ width: `${Math.max(3, progress)}%` }}
              />
            </div>
            <span className={`font-mono text-xs font-bold ${textColor}`}>
              {progress}%
            </span>
          </div>
        </div>
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    )
  }

  // Expanded view - full card
  return (
    <div className="fixed top-24 right-4 z-[9999] w-80 rounded-2xl border border-border bg-card/95 backdrop-blur-md p-5 shadow-2xl animate-rise">
      {/* Header with collapse button */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            {isComplete ? 'Investigation Complete' : 'Investigation Progress'}
          </span>
          <span className="font-mono text-sm text-foreground mt-1">
            {stageLabel[stage]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold tabular-nums ${textColor}`}>
            {progress}%
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
            aria-label="Collapse"
          >
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-2.5 w-full rounded-full bg-muted overflow-hidden mb-5"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Investigation progress: ${progress}%`}
      >
        <div
          className={`h-full rounded-full ${progressColor} transition-all duration-1000 ease-out`}
          style={{ width: `${Math.max(3, progress)}%` }}
        />
      </div>

      {/* Steps list */}
      <div className="space-y-2.5">
        {detectionSteps.map((step, i) => {
          const isDone = i < checkedCount
          const isActive = hasActiveStep && i === checkedCount

          return (
            <div
              key={step}
              className={`flex items-center gap-3 transition-all duration-300 ${
                isDone || isActive ? 'opacity-100' : 'opacity-40'
              }`}
            >
              {/* Status indicator */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {isDone ? (
                  <svg
                    className={`w-4 h-4 ${isComplete ? 'text-green-500' : 'text-primary'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : isActive ? (
                  <div
                    className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-primary'} animate-pulse`}
                  />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>

              {/* Step text */}
              <span
                className={`font-mono text-xs flex-1 ${
                  isActive
                    ? 'text-foreground font-medium'
                    : isDone
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50'
                }`}
              >
                {step}
              </span>

              {/* Status label */}
              {isDone && (
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  done
                </span>
              )}
              {isActive && (
                <span
                  className={`font-mono text-[10px] animate-pulse ${isComplete ? 'text-green-500' : 'text-primary'}`}
                >
                  scanning...
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Live stats */}
      <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] text-muted-foreground/60">
            Commits
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">
            {snapshot.coverage.commits_enriched}
            <span className="text-muted-foreground/60 font-normal">
              /{snapshot.coverage.commits_discovered}
            </span>
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[10px] text-muted-foreground/60">
            Repositories
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">
            {snapshot.coverage.repos_scanned}
            <span className="text-muted-foreground/60 font-normal">
              /{snapshot.coverage.repos_total}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

const mapErrorToState = (snapshot: ScoreJobSnapshot | null) => {
  if (!snapshot || snapshot.status !== 'failed' || !snapshot.error) {
    return null
  }

  if (snapshot.error.code === 'not_found') {
    return {
      title: 'Ghost account',
      description:
        "That username doesn't exist. Either they deleted everything and ran, or you can't spell.",
    }
  }

  if (snapshot.error.code === 'job_not_found') {
    return {
      title: 'Score expired',
      description: 'That score job vanished. Start a fresh scan.',
    }
  }

  if (snapshot.error.code === 'rate_limited') {
    return {
      title: 'GitHub says chill',
      description:
        'We hit the API rate limit. Even surveillance has bureaucracy. Try again in a minute.',
    }
  }

  if (snapshot.error.code === 'invalid_username') {
    return {
      title: "That's not a username",
      description: "GitHub usernames don't look like that. We checked.",
    }
  }

  return {
    title: 'The vibes are unclear',
    description:
      'Something went wrong on our end. The slop detector needs a minute.',
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
      {!data ? (
        snapshot ? (
          <InvestigationView snapshot={snapshot} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 animate-rise" role="status" aria-live="polite">
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              Starting investigation...
            </p>
          </div>
        )
      ) : (
        <>
          {(() => {
            const isStillProcessing =
              snapshot?.coverage.is_partial ||
              (snapshot?.coverage.commits_enriched ?? 0) <
                (snapshot?.coverage.commits_discovered ?? 0) ||
              snapshot?.status === 'running'

            if (isStillProcessing && snapshot) {
              return <MiniProgress snapshot={snapshot} />
            }
            return null
          })()}
          <section
            id="share-card"
            className="flex flex-col gap-8 rounded-xl border border-border bg-card p-8 animate-rise"
          >
            <div className="flex items-center gap-4">
              <Image
                src={`https://github.com/${username}.png`}
                alt={`${username}'s avatar`}
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
                <p className="text-sm text-muted-foreground">
                  {confidenceLine[data.confidence]}
                </p>
                {hasLowSignal ? (
                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                    Not enough commits to judge. Suspiciously quiet, or just on
                    vacation.
                  </div>
                ) : null}
                <ShareActions username={username} />
              </div>
            </div>
          </section>

          {snapshot ? (
            <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4 animate-rise">
              {[
                {
                  value: snapshot.coverage.commits_enriched,
                  label: 'commits inspected',
                },
                {
                  value: snapshot.coverage.repos_scanned,
                  label: 'repos raided',
                },
                {
                  value: `${snapshot.coverage.window_days}d`,
                  label: 'crime window',
                },
                {
                  value: snapshot.coverage.sources_used.length,
                  label: 'intel sources',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-1 bg-card px-4 py-4"
                >
                  <span className="font-mono text-lg font-bold text-foreground">
                    {stat.value}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              ))}
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            {data.top_signals.map((signal) => (
              <div
                key={signal}
                className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground animate-rise animate-delay-1"
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
        Entertainment purposes only. No commits were harmed in the making of
        this score.
      </p>

      <SiteFooter />
    </>
  )
}
