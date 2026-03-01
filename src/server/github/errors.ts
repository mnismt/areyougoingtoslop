export class GitHubError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

export class GitHubRateLimitError extends GitHubError {
  readonly resetAt: string

  constructor(message: string, resetAt: string, status?: number) {
    super(message, status)
    this.name = 'GitHubRateLimitError'
    this.resetAt = resetAt
  }
}

export class GitHubNotFoundError extends GitHubError {
  constructor(message = 'GitHub resource not found') {
    super(message, 404)
    this.name = 'GitHubNotFoundError'
  }
}

export class GitHubValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubValidationError'
  }
}

export class GitHubOrganizationError extends GitHubError {
  constructor(message = 'GitHub organization accounts are not supported') {
    super(message, 422)
    this.name = 'GitHubOrganizationError'
  }
}
