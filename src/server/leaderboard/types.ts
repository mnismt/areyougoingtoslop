export type LeaderboardEntry = {
  username: string
  slop_score: number
  tier: string
  tier_tagline?: string
  confidence: 'low' | 'medium' | 'high'
  last_scored_at: string
}
