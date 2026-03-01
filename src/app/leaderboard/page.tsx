import Image from 'next/image'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
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
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-10 animate-rise sm:gap-10 sm:py-16"
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

      <section className="rounded-xl border border-border bg-card p-6">
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
                className="card-lift group flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-sm md:flex-row md:items-center md:justify-between animate-rise"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`text-lg font-bold w-8 ${rankDisplay(index)}`}
                  >
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
                <div className="grid grid-cols-[3rem_5rem_7rem] items-center gap-4 font-mono text-xs md:ml-auto">
                  <span
                    className={`text-lg font-bold text-right ${scoreColor(entry.slop_score)}`}
                  >
                    {entry.slop_score}
                  </span>
                  <span className="text-muted-foreground text-center">
                    {entry.confidence}
                  </span>
                  <span className="text-muted-foreground text-right">
                    {formatDate(entry.last_scored_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  )
}
