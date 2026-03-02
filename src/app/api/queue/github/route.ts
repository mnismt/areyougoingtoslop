import { NextResponse } from 'next/server'
import { getGitHubQueueSnapshot } from '../../../../server/queue/github-queue-observer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const GET = async (request: Request) => {
  const opsToken = process.env.OPS_TOKEN
  if (!opsToken || request.headers.get('authorization') !== `Bearer ${opsToken}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const snapshot = await getGitHubQueueSnapshot()
  return NextResponse.json(snapshot, {
    headers: {
      'cache-control': 'no-store',
    },
  })
}
