import {
  createQueuedGitHubClient,
  isGitHubRequestQueueEnabled,
} from '../queue/github-request-queue'
import { createRawGitHubClient, type GitHubRequestOptions } from './raw-client'

export type { GitHubRequestOptions }

type GitHubClientSelectionMode = 'queued' | 'raw_fetcher' | 'raw_queue_disabled'

type GitHubClientSelectionState = {
  queued: number
  raw_fetcher: number
  raw_queue_disabled: number
  last_selected: GitHubClientSelectionMode | null
  updated_at: string | null
}

const getSelectionState = (): GitHubClientSelectionState => {
  const globalState = globalThis as typeof globalThis & {
    __aysGitHubClientSelectionState?: GitHubClientSelectionState
  }

  if (!globalState.__aysGitHubClientSelectionState) {
    globalState.__aysGitHubClientSelectionState = {
      queued: 0,
      raw_fetcher: 0,
      raw_queue_disabled: 0,
      last_selected: null,
      updated_at: null,
    }
  }

  return globalState.__aysGitHubClientSelectionState
}

const recordSelection = (mode: GitHubClientSelectionMode) => {
  const state = getSelectionState()
  state[mode] += 1
  state.last_selected = mode
  state.updated_at = new Date().toISOString()
}

export const getGitHubClientSelectionStats = () => {
  const state = getSelectionState()
  return {
    queued: state.queued,
    raw_fetcher: state.raw_fetcher,
    raw_queue_disabled: state.raw_queue_disabled,
    last_selected: state.last_selected,
    updated_at: state.updated_at,
  }
}

export const createGitHubClient = (options: GitHubRequestOptions) => {
  if (options.fetcher) {
    recordSelection('raw_fetcher')
    return createRawGitHubClient(options)
  }

  if (!isGitHubRequestQueueEnabled()) {
    recordSelection('raw_queue_disabled')
    return createRawGitHubClient(options)
  }

  recordSelection('queued')
  return createQueuedGitHubClient(options)
}
