import type { ContributionEvent } from '../types'
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from './config'
import { mapScoreToTier } from './tier'

const AI_TOOL_PATTERN =
  '(?:github\\s+copilot|copilot|chatgpt|openai|claude|cursor|devin)'

const STRONG_AI_ATTRIBUTION_PATTERNS = [
  /\b(?:ai|llm)[-\s]?generated\b/i,
  new RegExp(
    `\\bgenerated\\s+(?:by|with|via|using)\\s+${AI_TOOL_PATTERN}\\b`,
    'i',
  ),
  new RegExp(
    `\\b(?:written|created|authored|drafted|produced|built)\\s+(?:by|with|via|using)\\s+${AI_TOOL_PATTERN}\\b`,
    'i',
  ),
  /\bco-authored-by:\s*[^\n]*\b(?:copilot|chatgpt|openai|claude|cursor|devin)\b/i,
]

const MEDIUM_AI_ATTRIBUTION_PATTERNS = [
  new RegExp(`\\b(?:using|with|via|through)\\s+${AI_TOOL_PATTERN}\\b`, 'i'),
  new RegExp(
    `\\b(?:assisted|paired)\\s+(?:by|with)\\s+${AI_TOOL_PATTERN}\\b`,
    'i',
  ),
  new RegExp(
    `\\b${AI_TOOL_PATTERN}\\s+(?:assisted|generated|draft(?:ed)?)\\b`,
    'i',
  ),
  /\b(?:ai|llm)[-\s]?assisted\b/i,
]

const TECHNICAL_CURSOR_CONTEXT_PATTERN =
  /\bcursor\s+(?:location|position|pos|column|row|line|screen|buffer|window|scroll|offset|move|moving|moved|stays?|state)\b/i

const MEDIUM_AI_ATTRIBUTION_STRENGTH = 0.6

const PROMPT_CRUMBS = [
  'as an ai language model',
  "here's the",
  "sure, here's",
  'let me know if you',
  'i cannot',
  "i can't",
]

const MAX_ANALYZED_COMMITS = 200

export type SignalResult = {
  key: string
  label: string
  score: number
  weight: number
  contribution: number
}

export type AnalyzedCommit = {
  sha: string
  repo: string
  message: string
  occurred_at: string
  additions?: number
  deletions?: number
  flags: string[]
}

export type SlopScoreResult = {
  slop_score: number
  tier: string
  confidence: 'low' | 'medium' | 'high'
  top_signals: string[]
  scoring_window: string
  analyzed_commits: AnalyzedCommit[]
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value))

const getAiAttributionStrength = (event: ContributionEvent) => {
  if (event.isMerge) {
    return 0
  }

  const message = event.message
  if (message.trim().length === 0) {
    return 0
  }

  if (STRONG_AI_ATTRIBUTION_PATTERNS.some((pattern) => pattern.test(message))) {
    return 1
  }

  if (TECHNICAL_CURSOR_CONTEXT_PATTERN.test(message)) {
    return 0
  }

  if (MEDIUM_AI_ATTRIBUTION_PATTERNS.some((pattern) => pattern.test(message))) {
    return MEDIUM_AI_ATTRIBUTION_STRENGTH
  }

  return 0
}

const getRecencyWeight = (
  occurredAt: string,
  now: Date,
  config: ScoringConfig,
) => {
  const occurred = new Date(occurredAt)
  if (Number.isNaN(occurred.getTime())) {
    return 0
  }
  const diffDays = (now.getTime() - occurred.getTime()) / (1000 * 60 * 60 * 24)
  for (const bucket of config.recencyBuckets) {
    if (diffDays <= bucket.days) {
      return bucket.weight
    }
  }
  return 0
}

const computeWeightedRatio = (
  matches: Array<{ weight: number }>,
  totalWeight: number,
) => {
  if (totalWeight === 0) {
    return 0
  }
  const matchWeight = matches.reduce((sum, match) => sum + match.weight, 0)
  return (matchWeight / totalWeight) * 100
}

const computeWeightedStrength = (
  matches: Array<{ weight: number; strength: number }>,
  totalWeight: number,
) => {
  if (totalWeight === 0) {
    return 0
  }
  const weightedStrength = matches.reduce(
    (sum, match) => sum + match.weight * match.strength,
    0,
  )
  return (weightedStrength / totalWeight) * 100
}

const genericMessage = (message: string) => {
  const trimmed = message.trim().toLowerCase()
  if (trimmed.length <= 6) {
    return true
  }
  return [
    'fix',
    'update',
    'wip',
    'cleanup',
    'chore',
    'tweak',
    'refactor',
  ].includes(trimmed)
}

const getDayKey = (occurredAt: string) =>
  new Date(occurredAt).toISOString().slice(0, 10)

const computeConfidence = (
  eventCount: number,
  statsCoverage: number,
): 'low' | 'medium' | 'high' => {
  if (eventCount < 5 || statsCoverage < 0.3) {
    return 'low'
  }
  if (eventCount < 15 || statsCoverage < 0.6) {
    return 'medium'
  }
  return 'high'
}

export const computeSlopScore = (
  events: ContributionEvent[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  now: Date = new Date(),
): SlopScoreResult => {
  const weightedEvents = events
    .map((event) => ({
      event,
      weight: getRecencyWeight(event.occurredAt, now, config),
    }))
    .filter((item) => item.weight > 0)

  const totalWeight = weightedEvents.reduce((sum, item) => sum + item.weight, 0)

  const statsEvents = weightedEvents.filter(
    (item) =>
      item.event.additions !== undefined || item.event.deletions !== undefined,
  )
  const statsCoverage =
    weightedEvents.length === 0 ? 0 : statsEvents.length / weightedEvents.length

  const aiKeywordMatches = weightedEvents
    .map((item) => ({
      ...item,
      strength: getAiAttributionStrength(item.event),
    }))
    .filter((item) => item.strength > 0)

  const promptCrumbMatches = weightedEvents.filter((item) =>
    PROMPT_CRUMBS.some((crumb) =>
      item.event.message.toLowerCase().includes(crumb),
    ),
  )

  const aiKeywordScore = computeWeightedStrength(aiKeywordMatches, totalWeight)
  const promptCrumbScore = computeWeightedRatio(promptCrumbMatches, totalWeight)

  const nonMergeStatsEvents = statsEvents.filter((item) => !item.event.isMerge)

  const dailyChanges = new Map<string, number>()
  nonMergeStatsEvents.forEach((item) => {
    const changes = (item.event.additions ?? 0) + (item.event.deletions ?? 0)
    if (changes === 0) {
      return
    }
    const key = getDayKey(item.event.occurredAt)
    const current = dailyChanges.get(key) ?? 0
    dailyChanges.set(key, current + changes * item.weight)
  })
  const maxDailyChanges = Math.max(0, ...dailyChanges.values())
  const velocityScore = clamp(
    ((maxDailyChanges - config.thresholds.velocitySpike) / 1400) * 100,
  )

  const largeGenericMatches = statsEvents.filter((item) => {
    const changes = (item.event.additions ?? 0) + (item.event.deletions ?? 0)
    return (
      changes >= config.thresholds.largeChange &&
      genericMessage(item.event.message)
    )
  })
  const totalLargeEligible = statsEvents.filter((item) => {
    const changes = (item.event.additions ?? 0) + (item.event.deletions ?? 0)
    return changes >= config.thresholds.largeChange
  })
  const apathyScore = computeWeightedRatio(
    largeGenericMatches,
    totalLargeEligible.reduce((sum, item) => sum + item.weight, 0),
  )

  const churnMatches = statsEvents.filter((item) => {
    const additions = item.event.additions ?? 0
    const deletions = item.event.deletions ?? 0
    return (
      !item.event.isMerge &&
      additions >= config.thresholds.churnAdditions &&
      deletions >= config.thresholds.churnDeletions
    )
  })
  const churnScore = computeWeightedRatio(
    churnMatches,
    statsEvents.reduce((sum, item) => sum + item.weight, 0),
  )

  const signalResults: SignalResult[] = [
    {
      key: 'ai_keywords',
      label: 'Commits with AI-attribution hints',
      score: aiKeywordScore,
      weight: config.weights.ai_keywords,
      contribution: aiKeywordScore * config.weights.ai_keywords,
    },
    {
      key: 'prompt_crumbs',
      label: 'Prompt crumbs left in the crime scene',
      score: promptCrumbScore,
      weight: config.weights.prompt_crumbs,
      contribution: promptCrumbScore * config.weights.prompt_crumbs,
    },
    {
      key: 'velocity_volume',
      label: 'Suspicious velocity spikes',
      score: velocityScore,
      weight: config.weights.velocity_volume,
      contribution: velocityScore * config.weights.velocity_volume,
    },
    {
      key: 'apathy_ratio',
      label: 'Massive diffs, zero explanation',
      score: apathyScore,
      weight: config.weights.apathy_ratio,
      contribution: apathyScore * config.weights.apathy_ratio,
    },
    {
      key: 'churn',
      label: 'Code churn that screams generate-paste-pray',
      score: churnScore,
      weight: config.weights.churn,
      contribution: churnScore * config.weights.churn,
    },
  ]

  const weightedScore = signalResults.reduce(
    (sum, signal) => sum + signal.contribution,
    0,
  )

  const slopScore = clamp(Math.round(weightedScore))
  const confidence = computeConfidence(weightedEvents.length, statsCoverage)
  const tier = mapScoreToTier(slopScore)

  const topSignals = signalResults
    .filter((signal) => signal.score > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((signal) => signal.label)

  if (topSignals.length === 0) {
    topSignals.push('Not enough evidence to convict (yet)')
  }

  const aiKeywordShas = new Set(aiKeywordMatches.map((m) => m.event.sha))
  const promptCrumbShas = new Set(promptCrumbMatches.map((m) => m.event.sha))
  const largeGenericShas = new Set(largeGenericMatches.map((m) => m.event.sha))
  const churnShas = new Set(churnMatches.map((m) => m.event.sha))

  const analyzedCommits: AnalyzedCommit[] = weightedEvents
    .slice(0, MAX_ANALYZED_COMMITS)
    .map((item) => {
      const flags: string[] = []
      if (aiKeywordShas.has(item.event.sha)) flags.push('ai_keyword')
      if (promptCrumbShas.has(item.event.sha)) flags.push('prompt_crumb')
      if (largeGenericShas.has(item.event.sha)) flags.push('large_generic')
      if (churnShas.has(item.event.sha)) flags.push('high_churn')
      return {
        sha: item.event.sha,
        repo: item.event.repo,
        message: item.event.message.slice(0, 200),
        occurred_at: item.event.occurredAt,
        additions: item.event.additions,
        deletions: item.event.deletions,
        flags,
      }
    })

  return {
    slop_score: slopScore,
    tier,
    confidence,
    top_signals: topSignals,
    scoring_window: 'last 180 days',
    analyzed_commits: analyzedCommits,
  }
}
