import Link from "next/link";
import UsernameForm from "./components/UsernameForm";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f15a291f,transparent_45%),radial-gradient(circle_at_20%_80%,#ffe0c233,transparent_35%),linear-gradient(140deg,#0b0a08_0%,#15110d_55%,#0b0a08_100%)]" />
      <div className="absolute -left-24 top-20 h-48 w-48 rounded-full bg-[#f15a2926] blur-3xl glow-pulse" />
      <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#ffe0c21c] blur-3xl glow-pulse" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-16 px-6 py-16">
        <header className="flex flex-col gap-6 text-sm uppercase tracking-[0.3em] text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <span>areyougoingslop</span>
          <Link
            href="/leaderboard"
            className="rounded-full border border-white/10 px-4 py-2 text-xs transition hover:border-white/40 hover:text-white"
          >
            public leaderboard: on
          </Link>
        </header>

        <section className="grid gap-12 md:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-8 animate-rise">
            <div className="flex flex-col gap-5">
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                A playful slop score for your GitHub behavior.
              </h1>
              <p className="max-w-xl text-lg text-white/70">
                We scan public activity, apply a transparent heuristic, and
                deliver a roast that’s funny without being cruel. It’s satire,
                not a verdict.
              </p>
            </div>
            <UsernameForm />
            <div className="flex flex-wrap gap-3 text-xs text-white/60">
              <span className="rounded-full border border-white/10 px-3 py-1">
                public data only
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1">
                recency-weighted
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1">
                roast the behavior
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-6 animate-rise animate-delay-1">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                Signal Preview
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-white">
                What we look for
              </h2>
              <ul className="mt-6 flex flex-col gap-4 text-sm text-white/70">
                <li>Commit messages that name-drop AI tools.</li>
                <li>Huge change spikes in tiny time windows.</li>
                <li>Generic messages paired with massive diffs.</li>
                <li>Churny rewrites that scream “regen.”</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#15120f] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                Disclaimer
              </p>
              <p className="mt-4 text-sm text-white/70">
                This is a humorous heuristic, not a detector. We don’t claim
                proof, just vibes with receipts.
              </p>
            </div>
          </div>
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
