import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { setEnv } from '../../../../server/env'
import { createFakeEnv } from '../../../../server/testing/fake-env'
import { GET } from './route'

const authed = () =>
  new Request('http://localhost/api/queue/github', {
    headers: { authorization: 'Bearer secret' },
  })

describe('queue github route', () => {
  let previousOpsToken: string | undefined
  beforeEach(() => {
    previousOpsToken = process.env.OPS_TOKEN
    process.env.OPS_TOKEN = 'secret'
  })
  afterEach(() => {
    process.env.OPS_TOKEN = previousOpsToken
    setEnv(null)
  })

  it('returns 401 without a valid OPS_TOKEN', async () => {
    const response = await GET(new Request('http://localhost/api/queue/github'))
    assert.equal(response.status, 401)
  })

  it('returns disabled snapshot when bindings are unavailable', async () => {
    setEnv(null)
    const response = await GET(authed())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')

    const body = await response.json()
    assert.equal(body.enabled, false)
    assert.equal(body.health, 'disabled')
    assert.equal(JSON.stringify(body).includes('token'), false)
  })

  it('returns an ok snapshot with bindings', async () => {
    setEnv(createFakeEnv().env)
    const response = await GET(authed())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')

    const body = await response.json()
    assert.equal(body.enabled, true)
    assert.equal(body.health, 'ok')
    assert.equal(body.queue.workers_configured, 4)
  })
})
