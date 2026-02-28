"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubValidationError = exports.GitHubNotFoundError = exports.GitHubRateLimitError = exports.GitHubError = void 0;
class GitHubError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'GitHubError';
        this.status = status;
    }
}
exports.GitHubError = GitHubError;
class GitHubRateLimitError extends GitHubError {
    constructor(message, resetAt, status) {
        super(message, status);
        this.name = 'GitHubRateLimitError';
        this.resetAt = resetAt;
    }
}
exports.GitHubRateLimitError = GitHubRateLimitError;
class GitHubNotFoundError extends GitHubError {
    constructor(message = 'GitHub resource not found') {
        super(message, 404);
        this.name = 'GitHubNotFoundError';
    }
}
exports.GitHubNotFoundError = GitHubNotFoundError;
class GitHubValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GitHubValidationError';
    }
}
exports.GitHubValidationError = GitHubValidationError;
