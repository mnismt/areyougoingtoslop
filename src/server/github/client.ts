import {
  createQueuedGitHubClient,
  isGitHubRequestQueueEnabled,
} from '../queue/github-request-queue'
import { createRawGitHubClient, type GitHubRequestOptions } from './raw-client'

export type { GitHubRequestOptions }

export const createGitHubClient = (options: GitHubRequestOptions) => {
  if (options.fetcher || !isGitHubRequestQueueEnabled()) {
    return createRawGitHubClient(options)
  }

  return createQueuedGitHubClient(options)
}
