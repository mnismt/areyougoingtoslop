import { NextResponse } from 'next/server'
import { createOrAttachScoreJob } from '../../../../../server/api/score-jobs'
import { MemoryRateLimiter } from '../../../../../server/rate-limit'

type Params = {
  params: Promise<{ username: string }>
}

const jobRateLimiter = new MemoryRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
})

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',').at(-1)?.trim()
  }
  return request.headers.get('x-real-ip') ?? undefined
}

export const POST = async (request: Request, { params }: Params) => {
  const ip = getClientIp(request)
  if (ip) {
    const limitResult = jobRateLimiter.check(ip, Date.now())
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Too many score requests. Try again later.' },
        { status: 429 },
      )
    }
  }

  const { username } = await params
  const result = await createOrAttachScoreJob(username)

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error.code,
        message: result.error.message,
      },
      {
        status: 400,
      },
    )
  }

  return NextResponse.json(result.snapshot, {
    status: result.snapshot.status === 'completed' ? 200 : 202,
    headers: {
      'cache-control': 'no-store',
    },
  })
}
