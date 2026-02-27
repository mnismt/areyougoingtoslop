import Image from 'next/image'
import Link from 'next/link'
import { getLeaderboard } from '../../server/leaderboard'

const formatDate = (value: string | null) => {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
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
          className="font-mono text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The Slop Leaderboard
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Ranked by slop score with a confidence floor. Updated from recent
          public scans.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[var(--muted)]">
          <span>Top 50</span>
          <span>Last updated {formatDate(leaderboard.updated_at)}</span>
        </div>

        {leaderboard.entries.length === 0 ? (
          <div className="mt-6 rounded-lg border border-[var(--border)] bg-gray-50 p-6 text-sm text-[var(--muted)]">
            No scores yet. Run a scan and the leaderboard will light up.
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {leaderboard.entries.map((entry, index) => (
              <div
                key={entry.username}
                className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-[var(--foreground)] w-8">
                    #{index + 1}
                  </span>
                  <Image
                    src={`https://github.com/${entry.username}.png`}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full bg-gray-100"
                    unoptimized
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--foreground)]">
                      @{entry.username}
                    </span>
                    <span className="font-mono text-xs text-[var(--muted)]">
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
                  <span className="text-[var(--muted)]">
                    {entry.confidence}
                  </span>
                  <span className="text-[var(--muted)]">
                    {formatDate(entry.last_scored_at)}
                  </span>
                  <Link
                    href={`/u/${entry.username}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-1 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[var(--muted)]">
        <span>Satirical heuristic. Roast the code, not the coder.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/how-it-works" className="hover:text-[var(--foreground)]">
            How it works
          </Link>
          <Link href="/feedback" className="hover:text-[var(--foreground)]">
            Feedback
          </Link>
          <Link href="/terms" className="hover:text-[var(--foreground)]">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-[var(--foreground)]">
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  )
}
