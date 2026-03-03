import {
  getCachedCommitArtifact,
  setCachedCommitArtifact,
} from '../cache/commit-artifact-cache'
import type { ContributionEvent } from '../types'
import { createGitHubClient } from './client'
import { GitHubError, GitHubRateLimitError } from './errors'
import type { GitHubCommit, GitHubEvent, GitHubRepo } from './types'
import { assertValidGitHubUsername } from './validation'

type ActivitySource = 'events' | 'repo_commits'

export type FetchUserActivityCoverage = {
  commitsDiscovered: number
  commitsEnriched: number
  reposScanned: number
  reposTotal: number
  windowDays: number
  isPartial: boolean
  sourcesUsed: ActivitySource[]
}

export type FetchUserActivityLimits = {
  rateLimited: boolean
  eventsPaginationLimited: boolean
}

export type FetchUserActivityProgress = {
  stage: 'discovering' | 'enriching' | 'finalizing'
  events: ContributionEvent[]
  coverage: FetchUserActivityCoverage
  limits: FetchUserActivityLimits
  progressPercent: number
}

export type FetchUserActivityResult = {
  events: ContributionEvent[]
  coverage: FetchUserActivityCoverage
  limits: FetchUserActivityLimits
}

export type FetchUserActivityOptions = {
  token?: string
  fetcher?: typeof fetch
  now?: Date
  maxPages?: number
  maxCommitStats?: number
  maxRepos?: number
  maxRepoCommitPages?: number
  onProgress?: (progress: FetchUserActivityProgress) => void | Promise<void>
}

const COMMIT_FETCH_CONCURRENCY = 5
const MAX_PAGES = 5
const MAX_REPOS_AUTH = 24
const MAX_REPOS_UNAUTH = 8
const MAX_REPO_COMMIT_PAGES_AUTH = 2
const MAX_REPO_COMMIT_PAGES_UNAUTH = 1
const MAX_COMMIT_STATS_AUTH = 500
const MAX_COMMIT_STATS_UNAUTH = 30
const COMMIT_ARTIFACT_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const RECENCY_DAYS = 180

const withinDays = (dateISO: string, days: number, now: Date) => {
  const date = new Date(dateISO)
  if (Number.isNaN(date.getTime())) {
    return false
  }
  const diffMs = now.getTime() - date.getTime()
  return diffMs <= days * 24 * 60 * 60 * 1000
}

const getWindowStartIso = (now: Date, days: number) => {
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - days)
  return start.toISOString()
}

const toEventKey = (repo: string, sha: string) => `${repo}:${sha}`

const normalizePushEvent = (event: GitHubEvent): ContributionEvent[] => {
  if (event.payload.commits && event.payload.commits.length > 0) {
    return event.payload.commits.map((commit) => ({
      id: toEventKey(event.repo.name, commit.sha),
      type: 'commit',
      repo: event.repo.name,
      sha: commit.sha,
      message: commit.message,
      occurredAt: event.created_at,
      isMerge: commit.message.startsWith('Merge '),
    }))
  }

  if (event.payload.head) {
    return [
      {
        id: toEventKey(event.repo.name, event.payload.head),
        type: 'commit',
        repo: event.repo.name,
        sha: event.payload.head,
        message: '',
        occurredAt: event.created_at,
        isMerge: false,
      },
    ]
  }

  return []
}

const mapRepoCommit = (
  repo: string,
  commit: {
    sha: string
    commit: {
      message: string
      author?: {
        date?: string
      }
      committer?: {
        date?: string
      }
    }
  },
) => {
  const message = commit.commit.message ?? ''
  const occurredAt =
    commit.commit.author?.date ??
    commit.commit.committer?.date ??
    new Date(0).toISOString()
  return {
    id: toEventKey(repo, commit.sha),
    type: 'commit' as const,
    repo,
    sha: commit.sha,
    message,
    occurredAt,
    isMerge: message.startsWith('Merge '),
  }
}

const mergeEvents = (events: ContributionEvent[]) => {
  const merged = new Map<string, ContributionEvent>()

  for (const event of events) {
    const key = toEventKey(event.repo, event.sha)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, {
        ...event,
        id: key,
      })
      continue
    }

    const existingTime = new Date(existing.occurredAt).getTime()
    const candidateTime = new Date(event.occurredAt).getTime()
    const occurredAt =
      Number.isNaN(existingTime) ||
      (!Number.isNaN(candidateTime) && candidateTime > existingTime)
        ? event.occurredAt
        : existing.occurredAt

    const message =
      event.message.trim().length > existing.message.trim().length
        ? event.message
        : existing.message

    merged.set(key, {
      ...existing,
      id: key,
      occurredAt,
      message,
      additions: existing.additions ?? event.additions,
      deletions: existing.deletions ?? event.deletions,
      filesChanged: existing.filesChanged ?? event.filesChanged,
      isMerge: Boolean(existing.isMerge || event.isMerge),
    })
  }

  return [...merged.values()]
}

const sortEvents = (events: ContributionEvent[]) => {
  return events.sort((a, b) => {
    const timeDiff =
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    if (timeDiff !== 0) {
      return timeDiff
    }

    const repoDiff = a.repo.localeCompare(b.repo)
    if (repoDiff !== 0) {
      return repoDiff
    }

    return a.sha.localeCompare(b.sha)
  })
}

const applyCommitStats = (
  events: ContributionEvent[],
  commits: Map<string, GitHubCommit>,
) => {
  return events.map((event) => {
    const commit = commits.get(toEventKey(event.repo, event.sha))
    if (!commit || !commit.stats) {
      return event
    }
    return {
      ...event,
      message: commit.commit.message || event.message,
      occurredAt: commit.commit.author?.date || event.occurredAt,
      additions: commit.stats.additions,
      deletions: commit.stats.deletions,
      filesChanged: commit.files?.length,
    }
  })
}

const getSourceList = (eventsCount: number, repoCommitsCount: number) => {
  const sources: ActivitySource[] = []
  if (eventsCount > 0) {
    sources.push('events')
  }
  if (repoCommitsCount > 0) {
    sources.push('repo_commits')
  }
  return sources
}

const buildCoverage = (
  params: {
    commitsDiscovered: number
    commitsEnriched: number
    reposScanned: number
    reposTotal: number
    sourcesUsed: ActivitySource[]
  },
  limits: FetchUserActivityLimits,
) => {
  return {
    commitsDiscovered: params.commitsDiscovered,
    commitsEnriched: params.commitsEnriched,
    reposScanned: params.reposScanned,
    reposTotal: params.reposTotal,
    windowDays: RECENCY_DAYS,
    isPartial:
      limits.rateLimited ||
      limits.eventsPaginationLimited ||
      params.reposScanned < params.reposTotal,
    sourcesUsed: params.sourcesUsed,
  }
}

const toProgressPercent = (
  stage: FetchUserActivityProgress['stage'],
  commitsEnriched: number,
  commitsTarget: number,
) => {
  if (stage === 'discovering') {
    return 15
  }
  if (stage === 'finalizing') {
    return 100
  }
  if (commitsTarget === 0) {
    return 85
  }
  const ratio = Math.min(1, commitsEnriched / commitsTarget)
  return 15 + Math.round(ratio * 80)
}

export const fetchUserActivityWithMetadata = async (
  username: string,
  options: FetchUserActivityOptions = {},
): Promise<FetchUserActivityResult> => {
  assertValidGitHubUsername(username)

  const token = options.token ?? process.env.GITHUB_TOKEN
  const client = createGitHubClient({
    token,
    fetcher: options.fetcher,
  })

  const now = options.now ?? new Date()
  const pages = options.maxPages ?? MAX_PAGES
  const maxRepos =
    options.maxRepos ?? (token ? MAX_REPOS_AUTH : MAX_REPOS_UNAUTH)
  const maxRepoCommitPages =
    options.maxRepoCommitPages ??
    (token ? MAX_REPO_COMMIT_PAGES_AUTH : MAX_REPO_COMMIT_PAGES_UNAUTH)

  const events: GitHubEvent[] = []
  const limits: FetchUserActivityLimits = {
    rateLimited: false,
    eventsPaginationLimited: false,
  }

  for (let page = 1; page <= pages; page += 1) {
    try {
      const pageEvents = await client.listUserPublicEvents(username, page)
      if (pageEvents.length === 0) {
        break
      }
      events.push(...pageEvents)
      const oldest = pageEvents[pageEvents.length - 1]
      if (oldest && !withinDays(oldest.created_at, RECENCY_DAYS, now)) {
        break
      }
    } catch (error) {
      if (error instanceof GitHubError && error.status === 422) {
        limits.eventsPaginationLimited = true
        break
      }
      throw error
    }
  }

  const recentEvents = events.filter((event) =>
    withinDays(event.created_at, RECENCY_DAYS, now),
  )

  const eventDerivedCommits = recentEvents.flatMap((event) => {
    if (event.type !== 'PushEvent') {
      return []
    }
    return normalizePushEvent(event)
  })

  const recentRepoCandidates = new Map<string, GitHubRepo>()
  for (let page = 1; page <= 2; page += 1) {
    try {
      const repos = await client.listUserRepos(username, page)
      if (repos.length === 0) {
        break
      }

      for (const repo of repos) {
        if (repo.fork || repo.archived || repo.disabled || repo.private) {
          continue
        }
        if (!withinDays(repo.pushed_at, RECENCY_DAYS, now)) {
          continue
        }
        recentRepoCandidates.set(repo.full_name, repo)
      }

      if (repos.length < 100) {
        break
      }
    } catch (error) {
      if (error instanceof GitHubRateLimitError) {
        limits.rateLimited = true
        break
      }
      throw error
    }
  }

  const eventRepos = [
    ...new Set(eventDerivedCommits.map((event) => event.repo)),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      full_name: name,
      fork: false,
      pushed_at: now.toISOString(),
    }))

  const repoCandidates = [...eventRepos, ...recentRepoCandidates.values()]
  const dedupedRepos = [
    ...new Map(repoCandidates.map((repo) => [repo.full_name, repo])).values(),
  ].sort((a, b) => {
    const pushedDiff =
      new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
    if (pushedDiff !== 0) {
      return pushedDiff
    }
    return a.full_name.localeCompare(b.full_name)
  })

  const reposToScan = dedupedRepos.slice(0, maxRepos)
  const reposTotal = dedupedRepos.length

  const since = getWindowStartIso(now, RECENCY_DAYS)
  const until = now.toISOString()
  const repoDerivedCommits: ContributionEvent[] = []
  let reposScanned = 0

  for (const repo of reposToScan) {
    if (limits.rateLimited) {
      break
    }
    reposScanned += 1

    for (let page = 1; page <= maxRepoCommitPages; page += 1) {
      try {
        const commits = await client.listRepoCommits(repo.full_name, {
          author: username,
          since,
          until,
          page,
        })

        if (commits.length === 0) {
          break
        }

        repoDerivedCommits.push(
          ...commits.map((commit) => mapRepoCommit(repo.full_name, commit)),
        )

        if (commits.length < 100) {
          break
        }
      } catch (error) {
        if (error instanceof GitHubRateLimitError) {
          limits.rateLimited = true
          break
        }
        if (
          error instanceof GitHubError &&
          (error.status === 409 || error.status === 422 || error.status === 404)
        ) {
          break
        }
        throw error
      }
    }
  }

  const merged = sortEvents(
    mergeEvents([...eventDerivedCommits, ...repoDerivedCommits]),
  )
  const sourcesUsed = getSourceList(
    eventDerivedCommits.length,
    repoDerivedCommits.length,
  )

  const baseCoverage = buildCoverage(
    {
      commitsDiscovered: merged.length,
      commitsEnriched: 0,
      reposScanned,
      reposTotal,
      sourcesUsed,
    },
    limits,
  )

  await options.onProgress?.({
    stage: 'discovering',
    events: merged,
    coverage: baseCoverage,
    limits,
    progressPercent: toProgressPercent('discovering', 0, 0),
  })

  const maxCommitStats =
    options.maxCommitStats ??
    (token ? MAX_COMMIT_STATS_AUTH : MAX_COMMIT_STATS_UNAUTH)
  const commitsToFetch = merged.slice(0, maxCommitStats)

  const commitStats = new Map<string, GitHubCommit>()
  let commitsEnriched = 0

  const uncachedCommits = commitsToFetch.filter((commit) => {
    const cached = getCachedCommitArtifact(commit.repo, commit.sha, now)
    if (!cached) {
      return true
    }
    commitStats.set(toEventKey(commit.repo, commit.sha), cached)
    commitsEnriched += 1
    return false
  })

  if (commitsEnriched > 0) {
    const enrichedEvents = sortEvents(applyCommitStats(merged, commitStats))
    const coverage = buildCoverage(
      {
        commitsDiscovered: merged.length,
        commitsEnriched,
        reposScanned,
        reposTotal,
        sourcesUsed,
      },
      limits,
    )
    await options.onProgress?.({
      stage: 'enriching',
      events: enrichedEvents,
      coverage,
      limits,
      progressPercent: toProgressPercent(
        'enriching',
        commitsEnriched,
        commitsToFetch.length,
      ),
    })
  }

  const tasks = uncachedCommits.map((commit) => async () => {
    try {
      const response = await client.getCommit(commit.repo, commit.sha)
      setCachedCommitArtifact(
        commit.repo,
        commit.sha,
        response,
        now,
        COMMIT_ARTIFACT_CACHE_TTL_MS,
      )
      return {
        key: toEventKey(commit.repo, commit.sha),
        value: response,
      }
    } catch (error) {
      if (error instanceof GitHubRateLimitError) {
        limits.rateLimited = true
      }
      return null
    }
  })

  const executing = new Set<Promise<void>>()
  const emitEnrichmentProgress = async () => {
    const enrichedEvents = sortEvents(applyCommitStats(merged, commitStats))
    const coverage = buildCoverage(
      {
        commitsDiscovered: merged.length,
        commitsEnriched,
        reposScanned,
        reposTotal,
        sourcesUsed,
      },
      limits,
    )

    await options.onProgress?.({
      stage: 'enriching',
      events: enrichedEvents,
      coverage,
      limits,
      progressPercent: toProgressPercent(
        'enriching',
        commitsEnriched,
        commitsToFetch.length,
      ),
    })
  }

  for (const task of tasks) {
    if (limits.rateLimited) {
      break
    }

    const running = task()
      .then((result) => {
        if (!result) {
          return
        }
        commitStats.set(result.key, result.value)
        commitsEnriched += 1
      })
      .finally(() => executing.delete(running))

    executing.add(running)

    if (executing.size >= COMMIT_FETCH_CONCURRENCY) {
      await Promise.race(executing)
      await emitEnrichmentProgress()
    }
  }

  if (executing.size > 0) {
    await Promise.all(executing)
    await emitEnrichmentProgress()
  }

  const enriched = sortEvents(applyCommitStats(merged, commitStats))
  const coverage = buildCoverage(
    {
      commitsDiscovered: merged.length,
      commitsEnriched,
      reposScanned,
      reposTotal,
      sourcesUsed,
    },
    limits,
  )

  await options.onProgress?.({
    stage: 'finalizing',
    events: enriched,
    coverage,
    limits,
    progressPercent: toProgressPercent(
      'finalizing',
      commitsEnriched,
      commitsToFetch.length,
    ),
  })

  return {
    events: enriched,
    coverage,
    limits,
  }
}

export const fetchUserActivity = async (
  username: string,
  options: FetchUserActivityOptions = {},
) => {
  const result = await fetchUserActivityWithMetadata(username, options)
  return result.events
}
