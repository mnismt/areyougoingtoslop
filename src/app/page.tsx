import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
import { getLeaderboard } from '../server/leaderboard'
import UsernameForm from './components/username-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  openGraph: {
    title: 'areyougoingtoslop',
    description:
      'how much of your github profile is ai slop? paste a username and find out.',
    images: ['/og.png?4362984378'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'areyougoingtoslop',
    description:
      'how much of your github profile is ai slop? paste a username and find out.',
    images: ['/og.png?4362984378'],
  },
}

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
  const leaderboard = await getLeaderboard({ limit: 6, confidenceFloor: 'low' })

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:gap-16 sm:px-6 sm:py-16"
    >
      <section className="flex flex-col items-center gap-4 text-center animate-rise sm:gap-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          are you going to{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-rose-400 to-primary animate-gradient-text">
            slop
          </span>
          ?
        </h1>
        <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
          paste a github username. we'll judge their commits so you don't have
          to.
        </p>
        <div className="w-full max-w-md">
          <UsernameForm />
        </div>
      </section>

      {leaderboard.entries.length > 0 && (
        <section className="flex flex-col gap-3 animate-rise animate-delay-1 sm:gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs text-muted-foreground">
              hall of shame
            </h2>
            <Link
              href="/wallofshame"
              className="group relative font-mono text-xs text-primary"
            >
              full wall of shame &rarr;
              <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leaderboard.entries.map((entry, i) => (
              <Link
                key={entry.username}
                href={`/u/${entry.username}`}
                style={{ animationDelay: `${120 + i * 60}ms` }}
                className="card-lift group flex items-center gap-3 rounded-xl border border-border bg-card p-4 animate-rise"
              >
                <Image
                  src={`https://github.com/${entry.username}.png`}
                  alt={`${entry.username}'s avatar`}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full bg-muted transition-transform duration-300 group-hover:scale-110"
                  unoptimized
                />
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">@{entry.username}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {entry.tier}
                  </span>
                </div>
                <span
                  className={`font-mono text-lg font-bold transition-transform duration-300 group-hover:scale-110 ${scoreColor(entry.slop_score)}`}
                >
                  {entry.slop_score}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4 animate-rise animate-delay-2">
        <h2 className="font-mono text-xs text-muted-foreground">
          what we sniff for
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {signals.map((signal, i) => (
            <div
              key={signal}
              style={{ animationDelay: `${200 + i * 50}ms` }}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2 font-mono text-xs text-muted-foreground animate-rise"
            >
              <span className="text-primary">▸</span>
              {signal}
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
