import Image from 'next/image'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
import { getLeaderboard } from '../server/leaderboard'
import UsernameForm from './components/username-form'

const scoreColor = (score: number) => {
  if (score <= 30) return 'score-low'
  if (score <= 70) return 'score-mid'
  return 'score-high'
}

const signals = [
  'commits with AI attribution hints',
  'suspiciously large diffs at 3am',
  'commit messages shorter than your attention span',
  'prompt crumbs left behind like digital breadcrumbs',
  'code churn that screams "generate, paste, pray"',
]

export default async function Home() {
  const leaderboard = await getLeaderboard({ limit: 6 })

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-16 px-6 py-16">
      <section className="flex flex-col items-center gap-6 text-center animate-rise">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Are you going <span className="text-primary">slop</span>?
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          Paste a GitHub username. We'll judge their commits so you don't have
          to.
        </p>
        <div className="w-full max-w-md">
          <UsernameForm />
        </div>
      </section>

      {leaderboard.entries.length > 0 && (
        <section className="flex flex-col gap-6 animate-rise animate-delay-1">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs text-muted-foreground">
              hall of shame
            </h2>
            <Link
              href="/leaderboard"
              className="font-mono text-xs text-primary hover:underline"
            >
              full wall of shame &rarr;
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leaderboard.entries.map((entry) => (
              <Link
                key={entry.username}
                href={`/u/${entry.username}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary hover:shadow-sm"
              >
                <Image
                  src={`https://github.com/${entry.username}.png`}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full bg-muted"
                  unoptimized
                />
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">@{entry.username}</span>
                  <span className="font-mono text-xs text-muted-foreground">
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

      <section className="flex flex-col gap-4 animate-rise animate-delay-1">
        <h2 className="font-mono text-xs text-muted-foreground">
          what we sniff for
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {signals.map((signal) => (
            <li
              key={signal}
              className="font-mono text-xs text-muted-foreground"
            >
              &bull; {signal}
            </li>
          ))}
        </ul>
      </section>

      <SiteFooter />
    </main>
  )
}
