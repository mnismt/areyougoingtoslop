import {
  type FetchUserActivityCoverage,
  type FetchUserActivityLimits,
  type FetchUserActivityProgress,
  fetchUserActivity,
  fetchUserActivityWithMetadata,
} from '../github'
import { computeSlopScore, type SlopScoreResult } from '../scoring'

export type ScoreCoverage = {
  commits_discovered: number
  commits_enriched: number
  repos_scanned: number
  repos_total: number
  window_days: number
  is_partial: boolean
  sources_used: string[]
}

export type ScoreLimits = {
  rate_limited: boolean
  events_pagination_limited: boolean
}

export type ScoreUserProgress = {
  stage: FetchUserActivityProgress['stage']
  progress_percent: number
  result: SlopScoreResult
  coverage: ScoreCoverage
  limits: ScoreLimits
}

export type ScoreUserWithMetadataResult = {
  result: SlopScoreResult
  coverage: ScoreCoverage
  limits: ScoreLimits
}

export type ScoreUserOptions = {
  token?: string
  fetcher?: typeof fetch
  now?: Date
  onProgress?: (progress: ScoreUserProgress) => void | Promise<void>
}

const toCoverage = (coverage: FetchUserActivityCoverage): ScoreCoverage => ({
  commits_discovered: coverage.commitsDiscovered,
  commits_enriched: coverage.commitsEnriched,
  repos_scanned: coverage.reposScanned,
  repos_total: coverage.reposTotal,
  window_days: coverage.windowDays,
  is_partial: coverage.isPartial,
  sources_used: coverage.sourcesUsed,
})

const toLimits = (limits: FetchUserActivityLimits): ScoreLimits => ({
  rate_limited: limits.rateLimited,
  events_pagination_limited: limits.eventsPaginationLimited,
})

const emitProgress = async (
  update: FetchUserActivityProgress,
  now: Date,
  onProgress?: ScoreUserOptions['onProgress'],
) => {
  if (!onProgress) {
    return
  }

  const score = computeSlopScore(update.events, undefined, now)
  await onProgress({
    stage: update.stage,
    progress_percent: update.progressPercent,
    result: score,
    coverage: toCoverage(update.coverage),
    limits: toLimits(update.limits),
  })
}

export const scoreUserWithMetadata = async (
  username: string,
  options: ScoreUserOptions = {},
): Promise<ScoreUserWithMetadataResult> => {
  const effectiveNow = options.now ?? new Date()

  const activity = await fetchUserActivityWithMetadata(username, {
    token: options.token,
    fetcher: options.fetcher,
    now: effectiveNow,
    onProgress: (progress) =>
      emitProgress(progress, effectiveNow, options.onProgress),
  })

  const finalResult = computeSlopScore(activity.events, undefined, effectiveNow)

  return {
    result: finalResult,
    coverage: toCoverage(activity.coverage),
    limits: toLimits(activity.limits),
  }
}

export const scoreUser = async (
  username: string,
  options: ScoreUserOptions = {},
): Promise<SlopScoreResult> => {
  if (!options.onProgress) {
    const effectiveNow = options.now ?? new Date()
    const events = await fetchUserActivity(username, {
      token: options.token,
      fetcher: options.fetcher,
      now: effectiveNow,
    })
    return computeSlopScore(events, undefined, effectiveNow)
  }

  const result = await scoreUserWithMetadata(username, options)
  return result.result
}
