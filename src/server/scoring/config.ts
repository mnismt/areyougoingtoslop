export type SignalKey =
  | 'ai_keywords'
  | 'prompt_crumbs'
  | 'apathy_ratio'
  | 'churn'

export type ScoringWeights = Record<SignalKey, number>

export type ScoringConfig = {
  weights: ScoringWeights
  recencyBuckets: {
    days: number
    weight: number
  }[]
  thresholds: {
    largeChange: number
    churnAdditions: number
    churnDeletions: number
    referenceFlags: number
  }
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    ai_keywords: 0.35,
    prompt_crumbs: 0.2,
    apathy_ratio: 0.25,
    churn: 0.2,
  },
  recencyBuckets: [
    { days: 30, weight: 1.0 },
    { days: 90, weight: 0.6 },
    { days: 180, weight: 0.3 },
  ],
  thresholds: {
    largeChange: 250,
    churnAdditions: 350,
    churnDeletions: 350,
    referenceFlags: 10,
  },
}
