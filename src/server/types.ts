export type ContributionEventType = "commit";

export type ContributionEvent = {
  id: string;
  type: ContributionEventType;
  repo: string;
  sha: string;
  message: string;
  occurredAt: string;
  additions?: number;
  deletions?: number;
  filesChanged?: number;
  isMerge?: boolean;
};

