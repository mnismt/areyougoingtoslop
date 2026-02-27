import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← back
      </Link>

      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs text-[var(--muted)]">Privacy</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Public data only.
        </h1>
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
        <p>
          We only process public GitHub activity available through the GitHub
          API. We do not require you to log in.
        </p>
        <p className="mt-4">
          To power the public leaderboard, we store GitHub usernames alongside
          their most recent slop score and timestamp.
        </p>
        <p className="mt-4">
          If you submit feedback, we store the message and may log your IP for
          abuse protection.
        </p>
        <p className="mt-4">
          We do not sell user data. This is a lightweight MVP, and we aim to
          keep data collection minimal.
        </p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[var(--muted)]">
        <span>Built for screenshots, not courtrooms.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-[var(--foreground)]">
            Terms
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
