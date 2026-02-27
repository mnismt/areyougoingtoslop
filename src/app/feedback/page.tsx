import Link from "next/link";
import FeedbackForm from "./feedback-form";

export default function FeedbackPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← back
      </Link>

      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs text-[var(--muted)]">Feedback</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Help us tune the roast.
        </h1>
        <p className="text-sm text-[var(--muted)]">
          We are calibrating the model. Tell us what feels off, what is spot
          on, and what to improve next.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <FeedbackForm />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[var(--muted)]">
        <span>Built for screenshots, not courtrooms.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/how-it-works" className="hover:text-[var(--foreground)]">
            How it works
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
