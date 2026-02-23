import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f15a291f,transparent_45%),radial-gradient(circle_at_20%_80%,#ffe0c233,transparent_35%),linear-gradient(140deg,#0b0a08_0%,#15110d_55%,#0b0a08_100%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-16">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]"
        >
          ← back
        </Link>

        <header className="flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            How scoring works
          </p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Transparent signals, not a verdict.
          </h1>
          <p className="text-sm text-white/70">
            We only use public GitHub activity and apply a lightweight heuristic.
            It is designed to be funny and directionally credible, not forensic
            evidence.
          </p>
        </header>

        <section className="grid gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Signals</h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-white/70">
              <li>Commit messages that name-drop AI tools.</li>
              <li>Large change spikes in tight time windows.</li>
              <li>Very generic messages paired with massive diffs.</li>
              <li>Churn-heavy commits with big adds and deletes.</li>
              <li>Prompt-like crumbs that slip into commit text.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Recency</h2>
            <p className="mt-4 text-sm text-white/70">
              The last 180 days matter most. Recent activity is weighted higher,
              with older data fading out so the score reflects current habits.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Confidence</h2>
            <p className="mt-4 text-sm text-white/70">
              Confidence reflects how much recent public data we have and how
              complete the commit stats look. Low confidence means the score is
              a softer guess.
            </p>
          </div>

          <div className="rounded-3xl border border-[#f15a2933] bg-[#f15a2914] p-6 text-sm text-[#f15a29]">
            Satirical heuristic, not proof. We roast behavior, never people.
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">
            Removal and hide requests
          </h2>
          <p className="mt-4 text-sm text-white/70">
            Post-MVP we plan to add a self-serve removal or hide request flow.
            Until then, contact the maintainers for takedown requests and we will
            remove leaderboard entries on review.
          </p>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          <span>Built for screenshots, not courtrooms.</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/feedback" className="hover:text-white">
              Feedback
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
