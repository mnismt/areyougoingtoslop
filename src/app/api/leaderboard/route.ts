import { NextResponse } from 'next/server'
import { getLeaderboard } from '../../../server/leaderboard'

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const limitParam = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : undefined

  const leaderboard = await getLeaderboard({ limit })
  return NextResponse.json({
    ...leaderboard,
    generated_at: new Date().toISOString(),
  })
}
