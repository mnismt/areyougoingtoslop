import Image from 'next/image'
import Link from 'next/link'
import { getLeaderboard } from '../server/leaderboard'
import UsernameForm from './components/username-form'

const scoreColor = (score: number) => {
  if (score <= 30) return 'score-low'
  if (score <= 70) return 'score-mid'
  return 'score-high'
}

export default async function Home() {
  const leaderboard = await getLeaderboard({ limit: 6 })

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-16 px-6 py-16">
      <section className="flex flex-col items-center gap-6 text-center animate-rise">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Are you going <span className="text-[var(--accent)]">slop</span>?
        </h1>
        <p className="max-w-lg text-lg text-[var(--muted)]">
          Enter a GitHub username to measure their slop levels.
        </p>
        <div className="w-full max-w-md">
          <UsernameForm />
        </div>
      </section>

      {leaderboard.entries.length > 0 && (
        <section className="flex flex-col gap-6 animate-rise animate-delay-1">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs text-[var(--muted)]">
              Top slop offenders
            </h2>
            <Link
              href="/leaderboard"
              className="font-mono text-xs text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leaderboard.entries.map((entry) => (
              <Link
                key={entry.username}
                href={`/u/${entry.username}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)] hover:shadow-sm"
              >
                <Image
                  src={`https://github.com/${entry.username}.png`}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full bg-gray-100"
                  unoptimized
                />
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">@{entry.username}</span>
                  <span className="font-mono text-xs text-[var(--muted)]">
                    {entry.tier}
                  </span>
                </div>
                <span
                  className={`font-mono text-lg font-bold ${scoreColor(entry.slop_score)}`}
                >
                  {entry.slop_score}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[var(--muted)]">
        <span>Satirical heuristic. Built for screenshots, not courtrooms.</span>
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
