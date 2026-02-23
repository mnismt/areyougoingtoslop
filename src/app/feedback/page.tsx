import Link from "next/link";
import FeedbackForm from "./FeedbackForm";

export default function FeedbackPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f15a291f,transparent_45%),radial-gradient(circle_at_20%_80%,#ffe0c233,transparent_35%),linear-gradient(140deg,#0b0a08_0%,#15110d_55%,#0b0a08_100%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]"
        >
          ← back
        </Link>

        <header className="flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Feedback
          </p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Help us tune the roast.
          </h1>
          <p className="text-sm text-white/70">
            We are calibrating the model. Tell us what feels off, what is spot
            on, and what to improve next.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <FeedbackForm />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          <span>Built for screenshots, not courtrooms.</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/how-it-works" className="hover:text-white">
              How scoring works
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
