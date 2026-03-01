export type TierInfo = {
  name: string
  tagline: string
}

const TIERS: Array<TierInfo & { maxScore: number }> = [
  {
    maxScore: 8,
    name: 'the untouched keyboard',
    tagline: 'you debug with print statements. respect.',
  },
  {
    maxScore: 22,
    name: 'the tab-key athlete',
    tagline: 'autocomplete exists. you choose not to know.',
  },
  {
    maxScore: 40,
    name: 'the prompt-curious',
    tagline: 'just a couple of tokens between old you and new you',
  },
  {
    maxScore: 60,
    name: 'the context window regular',
    tagline: 'you have a system prompt and a ritual',
  },
  {
    maxScore: 75,
    name: 'the delegation economy',
    tagline: 'why code when you can orchestrate?',
  },
  {
    maxScore: 90,
    name: 'the fully cooked instance',
    tagline: 'running on tokens, not thoughts',
  },
  {
    maxScore: 100,
    name: 'the unsupervised slop machine',
    tagline: 'are they even there? hello? anyone home?',
  },
]

export const mapScoreToTier = (score: number): TierInfo => {
  for (const tier of TIERS) {
    if (score <= tier.maxScore) {
      return { name: tier.name, tagline: tier.tagline }
    }
  }
  const last = TIERS[TIERS.length - 1]
  return { name: last.name, tagline: last.tagline }
}
