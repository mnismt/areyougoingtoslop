export type LeaderboardEntry = {
  username: string;
  slop_score: number;
  tier: string;
  confidence: "low" | "medium" | "high";
  last_scored_at: string;
};
