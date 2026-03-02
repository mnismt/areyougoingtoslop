import { NextResponse } from 'next/server'
import { getGitHubQueueSnapshot } from '../../../../server/queue/github-queue-observer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const GET = async () => {
  const snapshot = await getGitHubQueueSnapshot()
  return NextResponse.json(snapshot, {
    headers: {
      'cache-control': 'no-store',
    },
  })
}
