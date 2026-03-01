import { NextResponse } from 'next/server'
import { createOrAttachScoreJob } from '../../../../../server/api/score-jobs'

type Params = {
  params: Promise<{ username: string }>
}

export const POST = async (_request: Request, { params }: Params) => {
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
