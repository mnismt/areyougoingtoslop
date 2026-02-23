import { createGitHubClient } from "./client";
import {
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubValidationError,
} from "./errors";
import type { GitHubCommit, GitHubEvent } from "./types";
import { assertValidGitHubUsername } from "./validation";
import type { ContributionEvent } from "../types";

export type FetchUserActivityOptions = {
  token?: string;
  fetcher?: typeof fetch;
  now?: Date;
  maxPages?: number;
  maxCommitStats?: number;
};

const MAX_PAGES = 5;
const MAX_COMMIT_STATS = 30;
const RECENCY_DAYS = 180;

const withinDays = (dateISO: string, days: number, now: Date) => {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const diffMs = now.getTime() - date.getTime();
  return diffMs <= days * 24 * 60 * 60 * 1000;
};

const normalizePushEvent = (event: GitHubEvent): ContributionEvent[] => {
  if (!event.payload.commits || event.payload.commits.length === 0) {
    return [];
  }
  return event.payload.commits.map((commit) => ({
    id: `${event.repo.name}:${commit.sha}`,
    type: "commit",
    repo: event.repo.name,
    sha: commit.sha,
    message: commit.message,
    occurredAt: event.created_at,
    isMerge: commit.message.startsWith("Merge "),
  }));
};

const applyCommitStats = (
  events: ContributionEvent[],
  commits: GitHubCommit[],
) => {
  const commitMap = new Map<string, GitHubCommit>();
  commits.forEach((commit) => {
    commitMap.set(commit.sha, commit);
  });

  return events.map((event) => {
    const commit = commitMap.get(event.sha);
    if (!commit || !commit.stats) {
      return event;
    }
    return {
      ...event,
      message: commit.commit.message || event.message,
      occurredAt: commit.commit.author?.date || event.occurredAt,
      additions: commit.stats.additions,
      deletions: commit.stats.deletions,
      filesChanged: commit.files?.length,
    };
  });
};

export const fetchUserActivity = async (
  username: string,
  options: FetchUserActivityOptions = {},
) => {
  assertValidGitHubUsername(username);

  const client = createGitHubClient({
    token: options.token ?? process.env.GITHUB_TOKEN,
    fetcher: options.fetcher,
  });

  try {
    await client.getUser(username);
  } catch (error) {
    if (error instanceof GitHubNotFoundError) {
      throw error;
    }
    if (error instanceof GitHubRateLimitError) {
      throw error;
    }
    throw new GitHubValidationError("Unable to validate GitHub user");
  }

  const now = options.now ?? new Date();
  const pages = options.maxPages ?? MAX_PAGES;
  const events: GitHubEvent[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const pageEvents = await client.listUserPublicEvents(username, page);
    if (pageEvents.length === 0) {
      break;
    }
    events.push(...pageEvents);
    const oldest = pageEvents[pageEvents.length - 1];
    if (oldest && !withinDays(oldest.created_at, RECENCY_DAYS, now)) {
      break;
    }
  }

  const recentEvents = events.filter((event) =>
    withinDays(event.created_at, RECENCY_DAYS, now),
  );

  const normalized = recentEvents.flatMap((event) => {
    if (event.type === "PushEvent") {
      return normalizePushEvent(event);
    }
    return [];
  });

  const maxCommitStats = options.maxCommitStats ?? MAX_COMMIT_STATS;
  const commitsToFetch = normalized.slice(0, maxCommitStats);
  const commitStats: GitHubCommit[] = [];

  for (const commit of commitsToFetch) {
    try {
      const detail = await client.getCommit(commit.repo, commit.sha);
      commitStats.push(detail);
    } catch (error) {
      if (error instanceof GitHubRateLimitError) {
        break;
      }
    }
  }

  const enriched = applyCommitStats(normalized, commitStats);

  return enriched.sort((a, b) => {
    const timeDiff =
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.sha.localeCompare(b.sha);
  });
};

