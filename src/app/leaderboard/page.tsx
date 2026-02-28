import Image from 'next/image'
import Link from 'next/link'
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

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard({ limit: 50 })

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          &larr; back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The Slop Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Ranked by slop score with a confidence floor. Updated from recent
          public scans.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
          <span>Top 50</span>
          <span>Last updated {formatDate(leaderboard.updated_at)}</span>
        </div>

        {leaderboard.entries.length === 0 ? (
          <div className="mt-6 rounded-lg border border-border bg-muted/50 p-6 text-sm text-muted-foreground">
            No scores yet. Run a scan and the leaderboard will light up.
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {leaderboard.entries.map((entry, index) => (
              <div
                key={entry.username}
                className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-foreground w-8">
                    #{index + 1}
                  </span>
                  <Image
                    src={`https://github.com/${entry.username}.png`}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full bg-muted"
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
                    <Link href={`/u/${entry.username}`}>View</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
        <span>Satirical heuristic. Roast the code, not the coder.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/feedback" className="hover:text-foreground">
            Feedback
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  )
}
