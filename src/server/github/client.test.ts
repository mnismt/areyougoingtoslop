import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isGitHubRequestQueueEnabled } from '../queue/github-request-queue'
import { createGitHubClient } from './client'

describe('createGitHubClient', () => {
  it('uses direct client when a custom fetcher is provided', async () => {
    const previousRedisUrl = process.env.REDIS_URL
    process.env.REDIS_URL = 'redis://127.0.0.1:6379'

    let calls = 0
    const mockFetch: typeof fetch = async () => {
      calls += 1
      return new Response('[]', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    try {
      const client = createGitHubClient({ fetcher: mockFetch })
      await client.listUserPublicEvents('octocat', 1)
      assert.equal(calls, 1)
    } finally {
      process.env.REDIS_URL = previousRedisUrl
    }
  })
})

describe('isGitHubRequestQueueEnabled', () => {
  it('reflects REDIS_URL availability', () => {
    const previousRedisUrl = process.env.REDIS_URL

    try {
      process.env.REDIS_URL = ''
      assert.equal(isGitHubRequestQueueEnabled(), false)

      process.env.REDIS_URL = 'redis://127.0.0.1:6379'
      assert.equal(isGitHubRequestQueueEnabled(), true)
    } finally {
      process.env.REDIS_URL = previousRedisUrl
    }
  })
})
