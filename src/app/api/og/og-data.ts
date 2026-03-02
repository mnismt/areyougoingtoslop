import {
  type ScoreCoverage,
  type ScoreLimits,
  scoreUserWithMetadata,
} from '../../../server/api/score'
import { getCachedScore, setCachedScore } from '../../../server/cache'
import {
  GitHubNotFoundError,
  GitHubOrganizationError,
  GitHubRateLimitError,
  GitHubValidationError,
  isValidGitHubUsername,
} from '../../../server/github'
import type { SlopScoreResult } from '../../../server/scoring'
import type { OgCardViewModel } from './og-card'

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000
const AVATAR_FETCH_TIMEOUT_MS = 1_800

type ResolveOgDataDeps = {
  now?: () => Date
  getCachedScore?: typeof getCachedScore
  setCachedScore?: typeof setCachedScore
  scoreUserWithMetadata?: typeof scoreUserWithMetadata
  isValidGitHubUsername?: typeof isValidGitHubUsername
  fetchAvatarDataUri?: (username: string) => Promise<string | null>
}

export type ResolveOgDataResult = {
  source: 'cache' | 'live' | 'fallback'
  viewModel: OgCardViewModel
}

const emptyLimits: ScoreLimits = {
  rate_limited: false,
  events_pagination_limited: false,
}

const toCoverageFromCache = (result: SlopScoreResult): ScoreCoverage => {
  const uniqueRepos = new Set(
    result.analyzed_commits.map((commit) => commit.repo),
  )
  const commitsEnriched = result.analyzed_commits.filter(
    (commit) =>
      commit.additions !== undefined || commit.deletions !== undefined,
  ).length

  return {
    commits_discovered: result.analyzed_commits.length,
    commits_enriched: commitsEnriched,
    repos_scanned: uniqueRepos.size,
    repos_total: uniqueRepos.size,
    window_days: 180,
    is_partial: false,
    sources_used: [],
  }
}

export const toResultViewModel = ({
  username,
  avatarDataUri,
  result,
  coverage,
  limits,
}: {
  username: string
  avatarDataUri: string | null
  result: SlopScoreResult
  coverage: ScoreCoverage
  limits: ScoreLimits
}): OgCardViewModel => {
  let statusLine: string | undefined

  if (coverage.is_partial) {
    statusLine = 'partial snapshot. investigation still running.'
  } else if (limits.rate_limited) {
    statusLine = 'github told us to slow down. we complied, reluctantly.'
  } else if (limits.events_pagination_limited) {
    statusLine = 'github hid some history. we still found enough for a roast.'
  }

  return {
    variant: 'result',
    username,
    avatarDataUri,
    slopScore: result.slop_score,
    tier: result.tier,
    tierTagline: result.tier_tagline,
    confidence: result.confidence,
    scoringWindow: result.scoring_window,
    stats: {
      commitsInspected: coverage.commits_enriched,
      reposRaided: coverage.repos_scanned,
      windowDays: coverage.window_days,
      intelSources: coverage.sources_used.length,
    },
    topSignals:
      result.top_signals.length > 0
        ? result.top_signals.slice(0, 3)
        : ['not enough evidence to convict (yet)'],
    statusLine,
  }
}

const formatResetTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return `${parsed.toISOString().replace('T', ' ').slice(0, 16)}z`
}

const toFallbackViewModel = (
  username: string,
  avatarDataUri: string | null,
  error: unknown,
): OgCardViewModel => {
  if (error instanceof GitHubNotFoundError) {
    return {
      variant: 'not_found',
      username,
      avatarDataUri,
      title: 'ghost account',
      subtitle:
        "that username doesn't exist. either they deleted everything and ran, or you can't spell.",
    }
  }

  if (error instanceof GitHubOrganizationError) {
    return {
      variant: 'organization',
      username,
      avatarDataUri,
      title: 'collective entity detected',
      subtitle: "we don't roast organizations. pick an actual developer.",
      note: 'single targets only. no mob rule.',
    }
  }

  if (error instanceof GitHubRateLimitError) {
    const resetTime = formatResetTime(error.resetAt)
    return {
      variant: 'rate_limited',
      username,
      avatarDataUri,
      title: 'github says chill',
      subtitle:
        resetTime != null
          ? `api rate limit hit. try again around ${resetTime}.`
          : 'api rate limit hit. try again in a minute.',
    }
  }

  if (error instanceof GitHubValidationError) {
    return {
      variant: 'invalid_username',
      username,
      avatarDataUri,
      title: 'invalid username',
      subtitle: 'github usernames use letters, numbers, and single hyphens.',
    }
  }

  return {
    variant: 'unavailable',
    username,
    avatarDataUri,
    title: 'the vibes are unclear',
    subtitle: 'score unavailable right now. the detector needs a minute.',
  }
}

export const fetchAvatarDataUri = async (
  username: string,
  options?: {
    fetcher?: typeof fetch
    timeoutMs?: number
  },
) => {
  const fetcher = options?.fetcher ?? fetch
  const controller = new AbortController()
  const timeoutMs = options?.timeoutMs ?? AVATAR_FETCH_TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetcher(`https://github.com/${username}.png`, {
      signal: controller.signal,
      headers: {
        Accept: 'image/png,image/*;q=0.9',
      },
    })

    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type') ?? 'image/png'
    if (!contentType.startsWith('image/')) {
      return null
    }

    const bytes = await response.arrayBuffer()
    if (bytes.byteLength === 0) {
      return null
    }

    return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export const resolveOgData = async (
  usernameRaw: string,
  deps: ResolveOgDataDeps = {},
): Promise<ResolveOgDataResult> => {
  const nowFactory = deps.now ?? (() => new Date())
  const validateUsername = deps.isValidGitHubUsername ?? isValidGitHubUsername
  const getCachedScoreImpl = deps.getCachedScore ?? getCachedScore
  const setCachedScoreImpl = deps.setCachedScore ?? setCachedScore
  const scoreUserWithMetadataImpl =
    deps.scoreUserWithMetadata ?? scoreUserWithMetadata
  const fetchAvatarDataUriImpl = deps.fetchAvatarDataUri ?? fetchAvatarDataUri

  const username = usernameRaw.trim()

  if (!validateUsername(username)) {
    return {
      source: 'fallback',
      viewModel: {
        variant: 'invalid_username',
        username,
        avatarDataUri: null,
        title: 'invalid username',
        subtitle: 'github usernames use letters, numbers, and single hyphens.',
      },
    }
  }

  const avatarPromise = fetchAvatarDataUriImpl(username).catch(() => null)
  const now = nowFactory()
  const cached = getCachedScoreImpl(username, now)
  if (cached) {
    return {
      source: 'cache',
      viewModel: toResultViewModel({
        username,
        avatarDataUri: await avatarPromise,
        result: cached,
        coverage: toCoverageFromCache(cached),
        limits: emptyLimits,
      }),
    }
  }

  try {
    const score = await scoreUserWithMetadataImpl(username)
    setCachedScoreImpl(username, score.result, now, DEFAULT_CACHE_TTL_MS)

    return {
      source: 'live',
      viewModel: toResultViewModel({
        username,
        avatarDataUri: await avatarPromise,
        result: score.result,
        coverage: score.coverage,
        limits: score.limits,
      }),
    }
  } catch (error) {
    return {
      source: 'fallback',
      viewModel: toFallbackViewModel(username, await avatarPromise, error),
    }
  }
}
