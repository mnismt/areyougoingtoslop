import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clearCommitArtifactCache } from '../cache'
import {
  fetchUserActivity,
  fetchUserActivityWithMetadata,
  GitHubRateLimitError,
  GitHubValidationError,
} from './index'

type MockRoute = {
  match: (url: URL) => boolean
  status?: number
  body?: unknown
  headers?: Record<string, string>
}

const createMockFetch = (routes: MockRoute[]) => {
  return async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    const route = routes.find((candidate) => candidate.match(url))
    if (!route) {
      return new Response('Not Found', { status: 404 })
    }
    const body = route.body ? JSON.stringify(route.body) : ''
    return new Response(body, {
      status: route.status ?? 200,
      headers: route.headers,
    })
  }
}

describe('fetchUserActivity', () => {
  it('rejects invalid usernames', async () => {
    await assert.rejects(
      () => fetchUserActivity('bad--name'),
      GitHubValidationError,
    )
  })

  it('dedupes events and repo commits with metadata coverage', async () => {
    clearCommitArtifactCache()

    const now = new Date('2026-02-23T00:00:00.000Z')
    let commitDetailCalls = 0

    const mockFetch = createMockFetch([
      {
        match: (url) =>
          url.pathname === '/users/octocat/events/public' &&
          url.searchParams.get('page') === '1',
        body: [
          {
            id: '1',
            type: 'PushEvent',
            repo: { name: 'octo/repo' },
            created_at: '2026-02-20T00:00:00.000Z',
            payload: {
              commits: [{ sha: 'abc', message: 'feat: ship it' }],
            },
          },
        ],
      },
      {
        match: (url) =>
          url.pathname === '/users/octocat/events/public' &&
          url.searchParams.get('page') === '2',
        body: [],
      },
      {
        match: (url) =>
          url.pathname === '/users/octocat/repos' &&
          url.searchParams.get('page') === '1',
        body: [
          {
            full_name: 'octo/repo',
            fork: false,
            pushed_at: '2026-02-21T00:00:00.000Z',
          },
        ],
      },
      {
        match: (url) =>
          url.pathname === '/users/octocat/repos' &&
          url.searchParams.get('page') === '2',
        body: [],
      },
      {
        match: (url) =>
          url.pathname === '/repos/octo/repo/commits' &&
          url.searchParams.get('page') === '1',
        body: [
          {
            sha: 'abc',
            commit: {
              message: 'feat: ship it',
              author: { date: '2026-02-20T00:00:00.000Z' },
            },
          },
          {
            sha: 'xyz',
            commit: {
              message: 'docs: update by chatgpt',
              author: { date: '2026-02-21T00:00:00.000Z' },
            },
          },
        ],
      },
      {
        match: (url) => url.pathname === '/repos/octo/repo/commits/abc',
        body: {
          sha: 'abc',
          commit: {
            message: 'feat: ship it',
            author: { date: '2026-02-20T00:00:00.000Z' },
          },
          stats: { additions: 10, deletions: 2, total: 12 },
          files: [{ filename: 'src/index.ts' }],
        },
      },
      {
        match: (url) => url.pathname === '/repos/octo/repo/commits/xyz',
        body: {
          sha: 'xyz',
          commit: {
            message: 'docs: update by chatgpt',
            author: { date: '2026-02-21T00:00:00.000Z' },
          },
          stats: { additions: 40, deletions: 3, total: 43 },
          files: [{ filename: 'README.md' }],
        },
      },
    ])

    const countingFetch: typeof fetch = async (input, _init) => {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      if (url.pathname.startsWith('/repos/octo/repo/commits/')) {
        commitDetailCalls += 1
      }
      return mockFetch(input)
    }

    const first = await fetchUserActivityWithMetadata('octocat', {
      fetcher: countingFetch,
      now,
      maxPages: 2,
      maxRepoCommitPages: 1,
      maxCommitStats: 10,
      maxRepos: 3,
    })

    assert.equal(first.events.length, 2)
    assert.equal(first.coverage.commitsDiscovered, 2)
    assert.equal(first.coverage.commitsEnriched, 2)
    assert.equal(first.coverage.reposScanned, 1)
    assert.equal(first.coverage.reposTotal, 1)
    assert.deepEqual(first.coverage.sourcesUsed, ['events', 'repo_commits'])
    assert.equal(first.events[0]?.sha, 'xyz')
    assert.equal(first.events[0]?.additions, 40)
    assert.equal(commitDetailCalls, 2)

    const second = await fetchUserActivityWithMetadata('octocat', {
      fetcher: countingFetch,
      now,
      maxPages: 2,
      maxRepoCommitPages: 1,
      maxCommitStats: 10,
      maxRepos: 3,
    })

    assert.equal(second.events.length, 2)
    assert.equal(commitDetailCalls, 2)

    clearCommitArtifactCache()
  })

  it('marks events pagination as limited when github returns 422', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    const mockFetch = createMockFetch([
      {
        match: (url) => url.pathname === '/users/octocat/events/public',
        status: 422,
        body: { message: 'pagination limited' },
      },
      {
        match: (url) => url.pathname === '/users/octocat/repos',
        body: [],
      },
    ])

    const result = await fetchUserActivityWithMetadata('octocat', {
      fetcher: mockFetch,
      now,
    })

    assert.equal(result.events.length, 0)
    assert.equal(result.limits.eventsPaginationLimited, true)
    assert.equal(result.coverage.isPartial, true)
  })

  it('throws a rate limit error when remaining is zero', async () => {
    const mockFetch = createMockFetch([
      {
        match: (url) => url.pathname === '/users/octocat/events/public',
        status: 403,
        body: { message: 'API rate limit exceeded' },
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1730000000',
        },
      },
    ])

    await assert.rejects(
      () => fetchUserActivity('octocat', { fetcher: mockFetch }),
      GitHubRateLimitError,
    )
  })
})
