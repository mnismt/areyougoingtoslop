import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
import { getLeaderboard } from '../../server/leaderboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'wall of shame',
  description: 'the most AI-assisted github profiles, ranked by their commitment to outsourcing.',
}

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
  const leaderboard = await getLeaderboard({
    limit: 50,
    confidenceFloor: 'low',
  })

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 py-10 animate-rise sm:gap-10 sm:px-6 sm:py-16"
    >
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="back-link font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="back-arrow">&larr;</span> back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          wall of shame
        </h1>
        <p className="text-sm text-muted-foreground">
          the most AI-assisted github profiles we've exposed. ranked by their
          commitment to outsourcing.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-3 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
          <span>top 50 offenders</span>
          <span>last updated {formatDate(leaderboard.updated_at)}</span>
        </div>

        {leaderboard.entries.length === 0 ? (
          <div className="mt-6 rounded-lg border border-border bg-muted/50 p-6 text-sm text-muted-foreground">
            nobody's been snitched on yet. that's about to change.
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {leaderboard.entries.map((entry, index) => (
              <Link
                key={entry.username}
                href={`/u/${entry.username}`}
                style={{ animationDelay: `${index * 40}ms` }}
                className="card-lift group flex items-center gap-2 sm:gap-4 rounded-lg border border-border bg-card p-2.5 sm:p-4 animate-rise overflow-hidden"
              >
                <span
                  className={`text-sm sm:text-lg font-bold w-7 sm:w-8 shrink-0 ${rankDisplay(index)}`}
                >
                  #{index + 1}
                </span>
                <Image
                  src={`https://github.com/${entry.username}.png`}
                  alt={`${entry.username}'s avatar`}
                  width={40}
                  height={40}
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted transition-transform duration-300 group-hover:scale-105 shrink-0"
                  unoptimized
                />

                <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-1">
                  <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                    <span className="text-sm sm:text-base font-medium text-foreground truncate">
                      @{entry.username}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate hidden sm:inline">
                      {entry.tier}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] sm:text-[11px] text-muted-foreground truncate">
                    {entry.tier_tagline}
                  </span>
                </div>

                <span
                  className={`font-mono text-lg sm:text-2xl font-bold shrink-0 ${scoreColor(entry.slop_score)}`}
                >
                  {entry.slop_score}
                </span>

                <span className="font-mono text-xs text-muted-foreground shrink-0 w-24 text-right hidden sm:block">
                  {formatDate(entry.last_scored_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  )
}
