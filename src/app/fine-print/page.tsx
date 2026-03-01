import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'

export const metadata: Metadata = {
  title: 'fine print',
  description:
    'what this is, what i touch, and how to get off the leaderboard.',
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
          the lawyers made me
        </p>
      </header>

      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">what this is</h2>
          <p className="text-sm text-muted-foreground">
            this is a satirical heuristic. a vibe check with delusions of
            grandeur. do not use this to hire, fire, grade, or shame anyone. use
            it to screenshot and send to your group chat.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">what i touch</h2>
          <p className="text-sm text-muted-foreground">
            public github api only. no login. no private repos. i store username
            + score for the leaderboard. i don&apos;t sell data. i barely have
            data.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">removal</h2>
          <p className="text-sm text-muted-foreground">
            want off the leaderboard? contact me. i'll probably ignore it, but
            occasionally i feel something.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">got a bone to pick?</h2>
          <p className="text-sm text-muted-foreground">
            complain to{' '}
            <a
              href="https://x.com/leodoan_"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              @leodoan_
            </a>
            . i probably won't care, but go ahead and try.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
