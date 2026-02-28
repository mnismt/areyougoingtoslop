"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRawGitHubClient = void 0;
const errors_1 = require("./errors");
const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_RETRIES = 2;
const buildQuery = (query) => {
    if (!query) {
        return '';
    }
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
            params.set(key, String(value));
        }
    });
    const serialized = params.toString();
    return serialized ? `?${serialized}` : '';
};
const sleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
const shouldRetry = (status) => status === 502 || status === 503 || status === 504;
const parseRateLimitReset = (resetHeader) => {
    if (!resetHeader) {
        return new Date(Date.now() + 60000).toISOString();
    }
    const resetSeconds = Number(resetHeader);
    if (Number.isNaN(resetSeconds)) {
        return new Date(Date.now() + 60000).toISOString();
    }
    return new Date(resetSeconds * 1000).toISOString();
};
const request = async (path, config, options) => {
    const fetcher = options.fetcher ?? fetch;
    const retries = options.retries ?? DEFAULT_RETRIES;
    const url = `${GITHUB_API_BASE}${path}${buildQuery(config.query)}`;
    const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...config.headers,
    };
    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
    }
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const response = await fetcher(url, {
            method: config.method ?? 'GET',
            headers,
        });
        if (response.status === 404) {
            throw new errors_1.GitHubNotFoundError();
        }
        if (response.status === 401) {
            throw new errors_1.GitHubError('GitHub token is invalid or expired. Remove GITHUB_TOKEN or set a valid one.', 401);
        }
        if (response.status === 403) {
            const remaining = response.headers.get('X-RateLimit-Remaining');
            if (remaining === '0') {
                const resetAt = parseRateLimitReset(response.headers.get('X-RateLimit-Reset'));
                throw new errors_1.GitHubRateLimitError('GitHub API rate limit exceeded', resetAt, response.status);
            }
        }
        if (response.status === 429) {
            const resetAt = parseRateLimitReset(response.headers.get('X-RateLimit-Reset'));
            throw new errors_1.GitHubRateLimitError('GitHub API rate limit exceeded', resetAt, response.status);
        }
        if (!response.ok) {
            if (attempt < retries && shouldRetry(response.status)) {
                await sleep(250 * 2 ** attempt);
                continue;
            }
            const text = await response.text();
            throw new errors_1.GitHubError(`GitHub API error: ${response.status} ${text}`, response.status);
        }
        return (await response.json());
    }
    throw new errors_1.GitHubError('GitHub API error: retry limit exceeded');
};
const createRawGitHubClient = (options) => ({
    getUser: (username) => request(`/users/${username}`, {}, options),
    listUserPublicEvents: (username, page) => request(`/users/${username}/events/public`, {
        query: {
            per_page: 100,
            page,
        },
    }, options),
    listUserRepos: (username, page) => request(`/users/${username}/repos`, {
        query: {
            per_page: 100,
            page,
            sort: 'pushed',
            type: 'owner',
        },
    }, options),
    listRepoCommits: (repoFullName, query) => request(`/repos/${repoFullName}/commits`, {
        query: {
            per_page: 100,
            page: query.page,
            author: query.author,
            since: query.since,
            until: query.until,
        },
    }, options),
    getCommit: (repoFullName, sha) => request(`/repos/${repoFullName}/commits/${sha}`, {}, options),
});
exports.createRawGitHubClient = createRawGitHubClient;
