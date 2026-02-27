import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← back
      </Link>

      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs text-[var(--muted)]">
          How scoring works
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Transparent signals, not a verdict.
        </h1>
        <p className="text-sm text-[var(--muted)]">
          We only use public GitHub activity and apply a lightweight heuristic.
          It is designed to be funny and directionally credible, not forensic
          evidence.
        </p>
      </header>

      <section className="grid gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-semibold">Signals</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-[var(--muted)]">
            <li>Commit messages that name-drop AI tools.</li>
            <li>Large change spikes in tight time windows.</li>
            <li>Very generic messages paired with massive diffs.</li>
            <li>Churn-heavy commits with big adds and deletes.</li>
            <li>Prompt-like crumbs that slip into commit text.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-semibold">Recency</h2>
          <p className="mt-4 text-sm text-[var(--muted)]">
            The last 180 days matter most. Recent activity is weighted higher,
            with older data fading out so the score reflects current habits.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-semibold">Confidence</h2>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Confidence reflects how much recent public data we have and how
            complete the commit stats look. Low confidence means the score is
            a softer guess.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-6 text-sm text-[var(--accent)]">
          Satirical heuristic, not proof. We roast behavior, never people.
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold">
          Removal and hide requests
        </h2>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Post-MVP we plan to add a self-serve removal or hide request flow.
          Until then, contact the maintainers for takedown requests and we will
          remove leaderboard entries on review.
        </p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[var(--muted)]">
        <span>Built for screenshots, not courtrooms.</span>
        <div className="flex flex-wrap gap-4">
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
  );
}
