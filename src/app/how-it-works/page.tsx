import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

export default function HowItWorksPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        &larr; back
      </Link>

      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs text-muted-foreground">
          How scoring works
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Transparent signals, not a verdict.
        </h1>
        <p className="text-sm text-muted-foreground">
          We only use public GitHub activity and apply a lightweight heuristic.
          It is designed to be funny and directionally credible, not forensic
          evidence.
        </p>
      </header>

      <section className="grid gap-4">
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold">Signals</h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
              <li>Commit messages that name-drop AI tools.</li>
              <li>Large change spikes in tight time windows.</li>
              <li>Very generic messages paired with massive diffs.</li>
              <li>Churn-heavy commits with big adds and deletes.</li>
              <li>Prompt-like crumbs that slip into commit text.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold">Recency</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              The last 180 days matter most. Recent activity is weighted higher,
              with older data fading out so the score reflects current habits.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold">Confidence</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Confidence reflects how much recent public data we have and how
              complete the commit stats look. Low confidence means the score is
              a softer guess.
            </p>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-primary/20 bg-accent-soft p-6 text-sm text-primary">
          Satirical heuristic, not proof. We roast behavior, never people.
        </div>
      </section>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold">Removal and hide requests</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Post-MVP we plan to add a self-serve removal or hide request flow.
            Until then, contact the maintainers for takedown requests and we
            will remove leaderboard entries on review.
          </p>
        </CardContent>
      </Card>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
        <span>Built for screenshots, not courtrooms.</span>
        <div className="flex flex-wrap gap-4">
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
