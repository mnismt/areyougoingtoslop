import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGitHubClient } from './client'

describe('createGitHubClient', () => {
  it('uses the custom fetcher when provided', async () => {
    let calls = 0
    let userAgent: string | undefined
    const mockFetch: typeof fetch = async (_url, init) => {
      calls += 1
      userAgent = (init?.headers as Record<string, string>)['User-Agent']
      return new Response('[]', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    const client = createGitHubClient({ fetcher: mockFetch })
    await client.listUserPublicEvents('octocat', 1)
    assert.equal(calls, 1)
    // GitHub 403s requests without a User-Agent, and Workers fetch sends none.
    assert.equal(userAgent, 'areyougoingtoslop')
  })

  it('trims getCommit to the fields scoring reads', async () => {
    const client = createGitHubClient({
      fetcher: async () =>
        Response.json({
          sha: 'abc',
          commit: { message: 'feat: x', author: { date: '2026-01-01' } },
          stats: { additions: 1, deletions: 2, total: 3 },
          files: [{ filename: 'a.ts', patch: 'x'.repeat(10_000) }],
          parents: [{ sha: 'p' }],
        }),
    })
    assert.deepEqual(await client.getCommit('o/r', 'abc'), {
      sha: 'abc',
      commit: { message: 'feat: x', author: { date: '2026-01-01' } },
      stats: { additions: 1, deletions: 2, total: 3 },
      files: [{ filename: 'a.ts' }],
    })
  })

  it('retries a network error and a 500 before succeeding', async () => {
    let calls = 0
    const client = createGitHubClient({
      fetcher: async () => {
        calls += 1
        if (calls === 1) throw new TypeError('connection reset')
        if (calls === 2) return new Response('oops', { status: 500 })
        return Response.json({ login: 'octocat', type: 'User' })
      },
    })
    assert.equal((await client.getUser('octocat')).login, 'octocat')
    assert.equal(calls, 3)
  })
})
