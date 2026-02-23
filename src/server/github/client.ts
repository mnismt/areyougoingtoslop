import {
  GitHubError,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from "./errors";
import type { GitHubCommit, GitHubEvent, GitHubUser } from "./types";

export type GitHubRequestOptions = {
  token?: string;
  fetcher?: typeof fetch;
  retries?: number;
};

type RequestConfig = {
  method?: string;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
};

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_RETRIES = 2;

const buildQuery = (query?: Record<string, string | number | undefined>) => {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const shouldRetry = (status: number) =>
  status === 429 || status === 502 || status === 503 || status === 504;

const parseRateLimitReset = (resetHeader: string | null) => {
  if (!resetHeader) {
    return new Date(Date.now() + 60_000).toISOString();
  }
  const resetSeconds = Number(resetHeader);
  if (Number.isNaN(resetSeconds)) {
    return new Date(Date.now() + 60_000).toISOString();
  }
  return new Date(resetSeconds * 1000).toISOString();
};

const request = async <T>(
  path: string,
  config: RequestConfig,
  options: GitHubRequestOptions,
): Promise<T> => {
  const fetcher = options.fetcher ?? fetch;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const url = `${GITHUB_API_BASE}${path}${buildQuery(config.query)}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...config.headers,
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetcher(url, {
      method: config.method ?? "GET",
      headers,
    });

    if (response.status === 404) {
      throw new GitHubNotFoundError();
    }

    if (response.status === 403) {
      const remaining = response.headers.get("X-RateLimit-Remaining");
      if (remaining === "0") {
        const resetAt = parseRateLimitReset(
          response.headers.get("X-RateLimit-Reset"),
        );
        throw new GitHubRateLimitError(
          "GitHub API rate limit exceeded",
          resetAt,
          response.status,
        );
      }
    }

    if (!response.ok) {
      if (attempt < retries && shouldRetry(response.status)) {
        await sleep(250 * 2 ** attempt);
        continue;
      }
      const text = await response.text();
      throw new GitHubError(
        `GitHub API error: ${response.status} ${text}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  throw new GitHubError("GitHub API error: retry limit exceeded");
};

export const createGitHubClient = (options: GitHubRequestOptions) => ({
  getUser: (username: string) =>
    request<GitHubUser>(`/users/${username}`, {}, options),
  listUserPublicEvents: (username: string, page: number) =>
    request<GitHubEvent[]>(
      `/users/${username}/events/public`,
      {
        query: {
          per_page: 100,
          page,
        },
      },
      options,
    ),
  getCommit: (repoFullName: string, sha: string) =>
    request<GitHubCommit>(
      `/repos/${repoFullName}/commits/${sha}`,
      {},
      options,
    ),
});

