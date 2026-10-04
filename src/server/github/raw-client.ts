import {
  GitHubError,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from './errors'
import type {
  GitHubCommit,
  GitHubCommitSummary,
  GitHubEvent,
  GitHubRepo,
  GitHubUser,
} from './types'

export type GitHubRequestOptions = {
  token?: string
  fetcher?: typeof fetch
  retries?: number
}

type RequestConfig = {
  method?: string
  query?: Record<string, string | number | undefined>
  headers?: Record<string, string>
}

const GITHUB_API_BASE = 'https://api.github.com'
const DEFAULT_RETRIES = 2
// A rate limit that resets within this window is waited out instead of failing the job.
const MAX_RATE_LIMIT_WAIT_MS = 30_000

const buildQuery = (query?: Record<string, string | number | undefined>) => {
  if (!query) {
    return ''
  }
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value))
    }
  })
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const shouldRetry = (status: number) => status >= 500

const parseRateLimitReset = (resetHeader: string | null) => {
  if (!resetHeader) {
    return new Date(Date.now() + 60_000).toISOString()
  }
  const resetSeconds = Number(resetHeader)
  if (Number.isNaN(resetSeconds)) {
    return new Date(Date.now() + 60_000).toISOString()
  }
  return new Date(resetSeconds * 1000).toISOString()
}

const request = async <T>(
  path: string,
  config: RequestConfig,
  options: GitHubRequestOptions,
): Promise<T> => {
  const fetcher = options.fetcher ?? fetch
  const retries = options.retries ?? DEFAULT_RETRIES
  const url = `${GITHUB_API_BASE}${path}${buildQuery(config.query)}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    // GitHub rejects requests without one; Workers fetch, unlike Node's, sends none.
    'User-Agent': 'areyougoingtoslop',
    ...config.headers,
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response: Response
    try {
      response = await fetcher(url, {
        method: config.method ?? 'GET',
        headers,
      })
    } catch (error) {
      // Network error (connection reset, DNS). Same backoff as a 5xx.
      if (attempt < retries) {
        await sleep(250 * 2 ** attempt)
        continue
      }
      throw error
    }

    if (response.status === 404) {
      throw new GitHubNotFoundError()
    }

    if (response.status === 401) {
      throw new GitHubError(
        'GitHub token is invalid or expired. Remove GITHUB_TOKEN or set a valid one.',
        401,
      )
    }

    if (
      response.status === 429 ||
      (response.status === 403 &&
        response.headers.get('X-RateLimit-Remaining') === '0')
    ) {
      const resetAt = parseRateLimitReset(
        response.headers.get('X-RateLimit-Reset'),
      )
      const waitMs = new Date(resetAt).getTime() - Date.now()
      if (attempt < retries && waitMs <= MAX_RATE_LIMIT_WAIT_MS) {
        await sleep(Math.max(waitMs, 250))
        continue
      }
      throw new GitHubRateLimitError(
        'GitHub API rate limit exceeded',
        resetAt,
        response.status,
      )
    }

    if (!response.ok) {
      if (attempt < retries && shouldRetry(response.status)) {
        await sleep(250 * 2 ** attempt)
        continue
      }
      const text = await response.text()
      throw new GitHubError(
        `GitHub API error: ${response.status} ${text}`,
        response.status,
      )
    }

    return (await response.json()) as T
  }

  throw new GitHubError('GitHub API error: retry limit exceeded')
}

export const createRawGitHubClient = (options: GitHubRequestOptions) => ({
  getUser: (username: string) =>
    request<GitHubUser>(`/users/${username}`, {}, options),
  listUserPublicEvents: (username: string, page: number) =>
    request<GitHubEvent[]>(
      `/users/${username}/events/public`,
      {
        query: {
          per_page: 100,
          page,
        },
      },
      options,
    ),
  listUserRepos: (username: string, page: number) =>
    request<GitHubRepo[]>(
      `/users/${username}/repos`,
      {
        query: {
          per_page: 100,
          page,
          sort: 'pushed',
          type: 'owner',
        },
      },
      options,
    ),
  listRepoCommits: (
    repoFullName: string,
    query: {
      author: string
      since: string
      until: string
      page: number
    },
  ) =>
    request<GitHubCommitSummary[]>(
      `/repos/${repoFullName}/commits`,
      {
        query: {
          per_page: 100,
          page: query.page,
          author: query.author,
          since: query.since,
          until: query.until,
        },
      },
      options,
    ),
  // Keep only what applyCommitStats reads: full responses carry every file's patch text
  // (hundreds of KB each), which would pile up under the 128 MB isolate limit.
  getCommit: async (
    repoFullName: string,
    sha: string,
  ): Promise<GitHubCommit> => {
    const commit = await request<GitHubCommit>(
      `/repos/${repoFullName}/commits/${sha}`,
      {},
      options,
    )
    return {
      sha: commit.sha,
      commit: {
        message: commit.commit.message,
        author: { date: commit.commit.author?.date },
      },
      stats: commit.stats,
      files: commit.files?.map((file) => ({ filename: file.filename })),
    }
  },
})
