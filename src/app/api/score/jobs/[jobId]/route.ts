import { NextResponse } from 'next/server'
import { getScoreJob } from '../../../../../server/api/score-jobs'

type Params = {
  params: Promise<{ jobId: string }>
}

export const GET = async (_request: Request, { params }: Params) => {
  const { jobId } = await params
  const snapshot = await getScoreJob(jobId)
  if (!snapshot) {
    return NextResponse.json(
      {
        error: 'job_not_found',
        message: 'Score job not found.',
      },
      { status: 404 },
    )
  }

  return NextResponse.json(snapshot, {
    headers: {
      'cache-control': 'no-store',
    },
  })
}
