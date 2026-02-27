import { GitHubValidationError } from './errors'

const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37})$/

export const isValidGitHubUsername = (username: string) => {
  if (!USERNAME_REGEX.test(username)) {
    return false
  }
  if (username.endsWith('-')) {
    return false
  }
  if (username.includes('--')) {
    return false
  }
  return true
}

export const assertValidGitHubUsername = (username: string) => {
  if (!isValidGitHubUsername(username)) {
    throw new GitHubValidationError('Invalid GitHub username format')
  }
}
