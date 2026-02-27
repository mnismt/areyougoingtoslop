import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← back
      </Link>

      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs text-[var(--muted)]">Terms</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Please keep it light.
        </h1>
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
        <p>
          areyougoingslop provides a satirical, heuristic score based on public
          GitHub activity. It is not a detector, proof, or professional
          analysis.
        </p>
        <p className="mt-4">
          Use this product for fun. Do not use it to make employment,
          compliance, or disciplinary decisions.
        </p>
        <p className="mt-4">
          We may update or remove leaderboard entries at our discretion,
          especially for abuse or removal requests.
        </p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[var(--muted)]">
        <span>Built for screenshots, not courtrooms.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-[var(--foreground)]">
            Privacy
          </Link>
          <Link href="/feedback" className="hover:text-[var(--foreground)]">
            Feedback
          </Link>
          <Link href="/how-it-works" className="hover:text-[var(--foreground)]">
            How it works
          </Link>
        </div>
      </footer>
    </main>
  )
}
