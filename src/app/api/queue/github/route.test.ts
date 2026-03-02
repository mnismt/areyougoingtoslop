import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GET } from './route'

describe('queue github route', () => {
  it('returns 401 without a valid OPS_TOKEN', async () => {
    const previousOpsToken = process.env.OPS_TOKEN
    process.env.OPS_TOKEN = 'secret'

    try {
      const request = new Request('http://localhost/api/queue/github')
      const response = await GET(request)
      assert.equal(response.status, 401)
    } finally {
      process.env.OPS_TOKEN = previousOpsToken
    }
  })

  it('returns disabled snapshot when queue mode is off', async () => {
    const previousRedisUrl = process.env.REDIS_URL
    const previousOpsToken = process.env.OPS_TOKEN
    process.env.REDIS_URL = ''
    process.env.OPS_TOKEN = 'secret'

    try {
      const request = new Request('http://localhost/api/queue/github', {
        headers: { authorization: 'Bearer secret' },
      })
      const response = await GET(request)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')

      const body = await response.json()
      assert.equal(body.enabled, false)
      assert.equal(body.health, 'disabled')
      assert.equal(JSON.stringify(body).includes('token'), false)
    } finally {
      process.env.REDIS_URL = previousRedisUrl
      process.env.OPS_TOKEN = previousOpsToken
    }
  })
})
