export type GitHubUser = {
  login: string
  id: number
  type: string
}

export type GitHubEventRepo = {
  name: string
}

export type GitHubEvent = {
  id: string
  type: string
  repo: GitHubEventRepo
  created_at: string
  payload: {
    commits?: Array<{
      sha: string
      message: string
    }>
    ref?: string
    size?: number
  }
}

export type GitHubCommitFile = {
  filename: string
}

export type GitHubCommit = {
  sha: string
  commit: {
    message: string
    author?: {
      date?: string
    }
  }
  stats?: {
    additions: number
    deletions: number
    total: number
  }
  files?: GitHubCommitFile[]
}
