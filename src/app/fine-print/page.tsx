import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
import FeedbackForm from './feedback-form'

export const metadata: Metadata = {
  title: 'fine print',
  description:
    'what this is, what we touch, and how to get off the leaderboard.',
}

export default function FinePrintPage() {
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
          the fine print
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          the lawyers made us
        </p>
      </header>

      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">what this is</h2>
          <p className="text-sm text-muted-foreground">
            this is a satirical heuristic&mdash;a vibe check with delusions of
            grandeur. do not use this to hire, fire, grade, or shame anyone. use
            it to screenshot and send to your group chat.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">what we touch</h2>
          <p className="text-sm text-muted-foreground">
            public GitHub API only. no login. no private repos. we store
            username + score for the leaderboard. we don&apos;t sell data. we
            barely have data.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">removal</h2>
          <p className="text-sm text-muted-foreground">
            want off the leaderboard? contact the maintainers. we'll probably
            ignore it, but occasionally we feel something.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">got a bone to pick?</h2>
          <FeedbackForm />
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
