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
  tier_tagline: string
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
      | 'is_organization'
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
    | 'is_organization'
    | 'not_found'
    | 'job_not_found'
    | 'rate_limited'
    | 'server_error'
  message: string
  reset_at?: string
}

const POLL_MS = 1200

const stageLabel: Record<ScoreJobSnapshot['stage'], string> = {
  queued: 'waiting in line...',
  discovering: 'digging through the evidence...',
  enriching: 'cross-referencing the receipts...',
  finalizing: "preparing the verdict. hope you're ready.",
}

const confidenceStyles: Record<ScoreResponse['confidence'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-accent-soft text-primary',
}

const confidenceLine: Record<ScoreResponse['confidence'], string> = {
  low: "not enough data to roast properly. either you're careful or you're ghosting github.",
  medium: 'the evidence is... mid. like your commit messages.',
  high: "we've got receipts for days. this slop is certified organic.",
}

const ErrorState = ({
  title,
  description,
}: {
  title: string
  description: string
}) => (
  <>
    <div className="rounded-xl border border-border bg-card p-8 text-left animate-rise">
      <p className="font-mono text-xs text-muted-foreground">{title}</p>
      <p className="mt-4 text-sm text-muted-foreground">{description}</p>
      <Button variant="outline" asChild className="mt-6 font-mono text-xs">
        <Link href="/">snitch on someone else</Link>
      </Button>
    </div>
    <p className="text-center font-mono text-xs text-muted-foreground">
      entertainment purposes only. no developers were harmed. some were humbled.
    </p>
    <SiteFooter />
  </>
)

const OrganizationErrorState = ({ username }: { username: string }) => (
  <>
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:gap-8 sm:p-8 animate-rise">
      <div className="flex items-center gap-3 sm:gap-4">
        <Image
          src={`https://github.com/${username}.png`}
          alt={`${username}'s avatar`}
          width={56}
          height={56}
          className="h-12 w-12 rounded-full bg-muted sm:h-14 sm:w-14"
          unoptimized
        />
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">
            @{username}
          </h1>
          <p className="font-mono text-sm text-foreground">collective entity</p>
          <p className="font-mono text-xs text-muted-foreground">
            this is an organization, not an individual developer
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 sm:gap-6 md:flex-row">
        <div className="flex flex-col items-center justify-center rounded-full bg-muted/50 p-8 sm:p-10">
          <span className="text-4xl font-bold text-muted-foreground sm:text-5xl">
            N/A
          </span>
          <span className="mt-2 font-mono text-xs text-muted-foreground">
            slop score
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="secondary"
              className="rounded-lg px-3 py-1 font-mono text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            >
              organization
            </Badge>
            <Badge
              variant="outline"
              className="rounded-lg px-3 py-1 font-mono text-xs text-muted-foreground"
            >
              not applicable
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            we don't roast organizations. they're just groups of humans trying
            their best. pick an actual developer.
          </p>
          <ShareActions username={username} />
        </div>
      </div>
    </section>

    <section className="grid gap-2 sm:gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-3 sm:p-5 text-sm text-muted-foreground animate-rise animate-delay-1">
        orgs don't write code. they collect stars and pretend
      </div>
      <div className="rounded-xl border border-border bg-card p-3 sm:p-5 text-sm text-muted-foreground animate-rise animate-delay-1">
        find a human with a pulse and commits
      </div>
      <div className="rounded-xl border border-border bg-card p-3 sm:p-5 text-sm text-muted-foreground animate-rise animate-delay-1">
        no mob rule here. single targets only
      </div>
    </section>

    <p className="text-center font-mono text-xs text-muted-foreground">
      entertainment purposes only. no developers were harmed. some were humbled.
    </p>

    <SiteFooter />
  </>
)

const detectionSteps = [
  'scanning for AI fingerprints at the scene',
  'hunting for prompt crumbs left behind',
  'measuring velocity spikes and 3am timestamps',
  'flagging massive diffs with lazy messages',
  'detecting generate-paste-pray churn',
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

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden animate-rise">
      {/* progress header */}
      <div className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
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
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          detection protocol
        </p>

        {/* Mobile: compact — show only the active step + count */}
        <div className="flex flex-col gap-2 sm:hidden">
          <div className="flex items-center gap-3 font-mono text-xs">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                hasActiveStep
                  ? 'animate-pulse bg-primary'
                  : checkedCount >= detectionSteps.length
                    ? 'bg-primary'
                    : 'bg-muted-foreground/20'
              }`}
            />
            <span className="text-foreground">
              {
                detectionSteps[
                  Math.min(checkedCount, detectionSteps.length - 1)
                ]
              }
            </span>
            {hasActiveStep && (
              <span className="ml-auto animate-pulse text-[10px] text-primary">
                scanning
              </span>
            )}
          </div>
          <p className="pl-4 font-mono text-[10px] text-muted-foreground">
            {checkedCount}/{detectionSteps.length} checks complete
          </p>
        </div>

        {/* Desktop: full list */}
        <div className="hidden flex-col gap-3 sm:flex">
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
                        ? 'animate-pulse bg-primary'
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
                  <span className="ml-auto animate-pulse text-[10px] text-primary">
                    scanning
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* live stats */}
      <div className="border-t border-border px-4 py-3 sm:px-6 sm:py-4">
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
            partial snapshot. the investigation continues.
          </p>
        ) : null}
        {snapshot.limits.rate_limited ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            github told us to slow down. we complied, reluctantly.
          </p>
        ) : null}
        {snapshot.limits.events_pagination_limited ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            github tried to hide some history. we found it anyway.
          </p>
        ) : null}
      </div>
    </section>
  )
}

const MiniProgress = ({ snapshot }: { snapshot: ScoreJobSnapshot }) => {
  const { stage, progress_percent: progress } = snapshot
  const [isExpanded, setIsExpanded] = useState(false)
  const isComplete = progress >= 100

  const progressColor = isComplete ? 'bg-green-500' : 'bg-primary'
  const textColor = isComplete ? 'text-green-500' : 'text-primary'

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

  // Collapsed: small pill FAB anchored bottom-right
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-4 z-[9999] flex items-center gap-2.5 rounded-full border border-border bg-card/95 px-3.5 py-2 shadow-lg backdrop-blur-md transition-colors hover:bg-card animate-rise"
        aria-label="Expand investigation progress"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isComplete ? 'bg-green-500' : 'animate-pulse bg-primary'
          }`}
        />
        <span
          className={`font-mono text-xs font-bold tabular-nums ${textColor}`}
        >
          {progress}%
        </span>
        <svg
          className="h-3 w-3 text-muted-foreground"
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
    )
  }

  // Expanded: card anchored bottom-right, never full-width
  return (
    <div className="fixed bottom-6 right-4 z-[9999] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-md animate-rise">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            {isComplete ? 'investigation complete' : 'investigation progress'}
          </span>
          <span className="mt-1 font-mono text-sm text-foreground">
            {stageLabel[stage]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xl font-bold tabular-nums ${textColor}`}>
            {progress}%
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="rounded-lg p-1 transition-colors hover:bg-muted"
            aria-label="Collapse"
          >
            <svg
              className="h-4 w-4 text-muted-foreground"
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
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted"
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

      {/* Steps */}
      <div className="space-y-2">
        {detectionSteps.map((step, i) => {
          const isDone = i < checkedCount
          const isActive = hasActiveStep && i === checkedCount

          return (
            <div
              key={step}
              className={`flex items-center gap-3 transition-all duration-300 ${
                isDone || isActive ? 'opacity-100' : 'opacity-30'
              }`}
            >
              <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                {isDone ? (
                  <svg
                    className={`h-3.5 w-3.5 ${isComplete ? 'text-green-500' : 'text-primary'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : isActive ? (
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${isComplete ? 'bg-green-500' : 'animate-pulse bg-primary'}`}
                  />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              <span
                className={`flex-1 font-mono text-xs ${
                  isActive
                    ? 'font-medium text-foreground'
                    : isDone
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50'
                }`}
              >
                {step}
              </span>
              {isActive && (
                <span
                  className={`font-mono text-[10px] ${isComplete ? 'text-green-500' : 'animate-pulse text-primary'}`}
                >
                  scanning
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Live stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] text-muted-foreground/60">
            commits
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">
            {snapshot.coverage.commits_enriched}
            <span className="font-normal text-muted-foreground/60">
              /{snapshot.coverage.commits_discovered}
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] text-muted-foreground/60">
            repos
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">
            {snapshot.coverage.repos_scanned}
            <span className="font-normal text-muted-foreground/60">
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
      title: 'ghost account',
      description:
        "that username doesn't exist. either they deleted everything and ran, or you can't spell.",
    }
  }

  if (snapshot.error.code === 'job_not_found') {
    return {
      title: 'score expired',
      description: 'that score job vanished. start a fresh scan.',
    }
  }

  if (snapshot.error.code === 'rate_limited') {
    return {
      title: 'github says chill',
      description:
        'we hit the API rate limit. even surveillance has bureaucracy. try again in a minute.',
    }
  }

  if (snapshot.error.code === 'invalid_username') {
    return {
      title: "that's not a username",
      description: "github usernames don't look like that. we checked.",
    }
  }

  if (snapshot.error.code === 'is_organization') {
    return {
      title: 'collective entity detected',
      description:
        "we don't roast organizations. they're just groups of humans trying their best. pick an actual developer.",
    }
  }

  return {
    title: 'the vibes are unclear',
    description:
      'something broke on our end. the slop detector needs a minute.',
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
          setNetworkError('unable to fetch score progress. please refresh.')
          stopPolling()
          return
        }

        if (!payload || !('job_id' in payload)) {
          setNetworkError('unable to fetch score progress. please refresh.')
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
          setNetworkError('unable to start score job. please try again.')
          return
        }

        if (!payload || !('job_id' in payload)) {
          setNetworkError('unable to start score job. please try again.')
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

  if (
    snapshot?.status === 'failed' &&
    snapshot.error?.code === 'is_organization'
  ) {
    return <OrganizationErrorState username={username} />
  }

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
    return <ErrorState title="network hiccup" description={networkError} />
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
          <div
            className="rounded-xl border border-border bg-card p-8 animate-rise"
            role="status"
            aria-live="polite"
          >
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              starting investigation...
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
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:gap-8 sm:p-8 animate-rise"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <Image
                src={`https://github.com/${username}.png`}
                alt={`${username}'s avatar`}
                width={56}
                height={56}
                className="h-12 w-12 rounded-full bg-muted sm:h-14 sm:w-14"
                unoptimized
              />
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">
                  @{username}
                </h1>
                <p className="font-mono text-sm text-foreground">{data.tier}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {data.tier_tagline}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 sm:gap-6 md:flex-row">
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
                    not enough commits to judge. either they're careful, or
                    they're on vacation.
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

          <section className="grid gap-2 sm:gap-4 md:grid-cols-3">
            {data.top_signals.map((signal) => (
              <div
                key={signal}
                className="rounded-xl border border-border bg-card p-3 sm:p-5 text-sm text-muted-foreground animate-rise animate-delay-1"
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
        entertainment purposes only. no developers were harmed. some were
        humbled.
      </p>

      <SiteFooter />
    </>
  )
}
