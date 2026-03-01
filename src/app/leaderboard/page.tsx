import Image from 'next/image'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
import { Button } from '@/components/ui/button'
import { getLeaderboard } from '../../server/leaderboard'

const formatDate = (value: string | null) => {
  if (!value) {
    return '\u2014'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '\u2014'
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const scoreColor = (score: number) => {
  if (score <= 30) return 'score-low'
  if (score <= 70) return 'score-mid'
  return 'score-high'
}

const rankDisplay = (index: number) => {
  if (index < 3) return 'text-foreground'
  return 'text-muted-foreground'
}

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard({ limit: 50 })

  return (
    <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="back-link font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="back-arrow">&larr;</span> back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Wall of Shame
        </h1>
        <p className="text-sm text-muted-foreground">
          The most AI-assisted GitHub profiles we've found so far. Ranked by
          slop score.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
          <span>top 50 offenders</span>
          <span>Last updated {formatDate(leaderboard.updated_at)}</span>
        </div>

        {leaderboard.entries.length === 0 ? (
          <div className="mt-6 rounded-lg border border-border bg-muted/50 p-6 text-sm text-muted-foreground">
            Nobody's been snitched on yet. Be the change you want to see.
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {leaderboard.entries.map((entry, index) => (
              <div
                key={entry.username}
                style={{ animationDelay: `${index * 40}ms` }}
                className="card-lift group flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-sm md:flex-row md:items-center md:justify-between animate-rise"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-lg font-bold w-8 ${rankDisplay(index)}`}>
                    #{index + 1}
                  </span>
                  <Image
                    src={`https://github.com/${entry.username}.png`}
                    alt={`${entry.username}'s avatar`}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full bg-muted transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">
                      @{entry.username}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {entry.tier}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                  <span
                    className={`text-lg font-bold ${scoreColor(entry.slop_score)}`}
                  >
                    {entry.slop_score}
                  </span>
                  <span className="text-muted-foreground">
                    {entry.confidence}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(entry.last_scored_at)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="font-mono text-xs"
                  >
                    <Link href={`/u/${entry.username}`}>Inspect</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  )
}
