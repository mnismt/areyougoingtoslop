import { NextResponse } from 'next/server'
import { getEnv } from '../../../server/env'
import { checkRateLimit } from '../../../server/rate-limit'

const MAX_FEEDBACK_ENTRIES = 200

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',').at(-1)?.trim()
  }
  return request.headers.get('x-real-ip') ?? undefined
}

export const POST = async (request: Request) => {
  const now = new Date()
  const ip = getClientIp(request)
  if (ip) {
    const limitResult = await checkRateLimit(
      `feedback:${ip}`,
      { windowMs: 10 * 60 * 1000, maxRequests: 5 },
      now.getTime(),
    )
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'Too many feedback submissions. Try again later.',
        },
        { status: 429 },
      )
    }
  }

  const payload = await request.json().catch(() => null)
  const message =
    typeof payload?.message === 'string' ? payload.message.trim() : ''
  if (!message || message.length < 5) {
    return NextResponse.json(
      { error: 'invalid_payload', message: 'Feedback is too short.' },
      { status: 400 },
    )
  }
  if (message.length > 1000) {
    return NextResponse.json(
      { error: 'invalid_payload', message: 'Feedback is too long.' },
      { status: 400 },
    )
  }

  // Keep only the newest MAX_FEEDBACK_ENTRIES rows (they hold IPs), as the old JSON file did.
  const db = getEnv().DB
  await db.batch([
    db
      .prepare(
        'INSERT INTO feedback (message, received_at, ip) VALUES (?, ?, ?)',
      )
      .bind(message, now.toISOString(), ip ?? null),
    db
      .prepare(
        'DELETE FROM feedback WHERE id <= (SELECT MAX(id) FROM feedback) - ?',
      )
      .bind(MAX_FEEDBACK_ENTRIES),
  ])

  return NextResponse.json({ ok: true }, { status: 201 })
}
