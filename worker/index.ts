import handler from 'vinext/server/fetch-handler'
import { failScoreJob, processScoreJob } from '../src/server/api/score-jobs'
import { type AppEnv, type ScoreJobMessage, setEnv } from '../src/server/env'

// Must match max_retries of the ays-score-jobs consumer in wrangler.jsonc.
const MAX_RETRIES = 2

type QueueMessage<T> = {
  body: T
  attempts: number
  ack(): void
  retry(options?: { delaySeconds?: number }): void
}

export default {
  fetch(
    request: Request,
    env: AppEnv,
    ctx: Parameters<typeof handler.fetch>[2],
  ) {
    setEnv(env)
    return handler.fetch(request, env, ctx)
  },
  async queue(
    batch: { messages: QueueMessage<ScoreJobMessage>[] },
    env: AppEnv,
  ) {
    setEnv(env)
    for (const message of batch.messages) {
      try {
        await processScoreJob(message.body, message.attempts)
        message.ack()
      } catch (error) {
        console.error('score_job_infra_error', {
          job_id: message.body.job_id,
          error,
        })
        if (message.attempts <= MAX_RETRIES) {
          message.retry({ delaySeconds: 30 })
          continue
        }
        // Last attempt: no dead-letter queue, so record the failure instead of leaving it active.
        await failScoreJob(message.body.job_id).catch((failError) =>
          console.error('score_job_fail_mark_error', {
            job_id: message.body.job_id,
            error: failError,
          }),
        )
        message.ack()
      }
    }
  },
}
