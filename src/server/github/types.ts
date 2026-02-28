export type GitHubUser = {
  login: string
  id: number
  type: string
}

export type GitHubEventRepo = {
  name: string
}

export type GitHubRepo = {
  full_name: string
  fork: boolean
  pushed_at: string
  archived?: boolean
  disabled?: boolean
  private?: boolean
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
    head?: string
    before?: string
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

export type GitHubCommitSummary = {
  sha: string
  commit: {
    message: string
    author?: {
      date?: string
    }
    committer?: {
      date?: string
    }
  }
}
