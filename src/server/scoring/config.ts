export type SignalKey =
  | "ai_keywords"
  | "prompt_crumbs"
  | "velocity_volume"
  | "apathy_ratio"
  | "churn";

export type ScoringWeights = Record<SignalKey, number>;

export type ScoringConfig = {
  weights: ScoringWeights;
  recencyBuckets: {
    days: number;
    weight: number;
  }[];
  thresholds: {
    largeChange: number;
    churnAdditions: number;
    churnDeletions: number;
    velocitySpike: number;
  };
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    ai_keywords: 0.3,
    prompt_crumbs: 0.15,
    velocity_volume: 0.2,
    apathy_ratio: 0.2,
    churn: 0.15,
  },
  recencyBuckets: [
    { days: 30, weight: 1.0 },
    { days: 90, weight: 0.6 },
    { days: 180, weight: 0.3 },
  ],
  thresholds: {
    largeChange: 200,
    churnAdditions: 300,
    churnDeletions: 300,
    velocitySpike: 600,
  },
};

