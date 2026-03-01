import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
import FeedbackForm from './feedback-form'

export const metadata: Metadata = {
  title: 'Fine Print',
  description:
    'What this is, what we touch, and how to get off the leaderboard.',
}

export default function FinePrintPage() {
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
          The fine print
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          the lawyers made us
        </p>
      </header>

      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">What this is</h2>
          <p className="text-sm text-muted-foreground">
            This is a satirical heuristic&mdash;a vibe check with delusions of
            grandeur. Do not use this to hire, fire, grade, or shame anyone. Use
            it to screenshot and send to your group chat.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">What we touch</h2>
          <p className="text-sm text-muted-foreground">
            Public GitHub API only. No login. No private repos. We store
            username + score for the leaderboard. We don&apos;t sell data. We
            barely have data.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Removal</h2>
          <p className="text-sm text-muted-foreground">
            Want off the leaderboard? Contact the maintainers. Self-serve
            removal is on the roadmap.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Got a bone to pick?</h2>
          <FeedbackForm />
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
