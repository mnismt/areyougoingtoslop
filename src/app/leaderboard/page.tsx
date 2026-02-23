import Link from "next/link";
import { getLeaderboard } from "../../server/leaderboard";

const formatDate = (value: string | null) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard({ limit: 50 });

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f15a291f,transparent_45%),radial-gradient(circle_at_20%_80%,#ffe0c233,transparent_35%),linear-gradient(140deg,#0b0a08_0%,#15110d_55%,#0b0a08_100%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4">
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]"
          >
            ← back
          </Link>
          <div className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              Public leaderboard
            </p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              The loudest slop scores, right now.
            </h1>
          </div>
          <p className="text-sm text-white/70">
            Ranked by slop score with a confidence floor. Updated from recent
            public scans.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            <span>Top 50</span>
            <span>Last updated {formatDate(leaderboard.updated_at)}</span>
          </div>

          {leaderboard.entries.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              No scores yet. Run a scan and the leaderboard will light up.
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {leaderboard.entries.map((entry, index) => (
                <div
                  key={entry.username}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#15120f] p-5 text-sm text-white/70 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold text-white">
                      #{index + 1}
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-white">@{entry.username}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                        {entry.tier}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em]">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                      Score {entry.slop_score}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-white/60">
                      {entry.confidence} confidence
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-white/50">
                      updated {formatDate(entry.last_scored_at)}
                    </span>
                    <Link
                      href={`/u/${entry.username}`}
                      className="rounded-full border border-white/10 px-3 py-1 text-white/70 transition hover:border-white/40 hover:text-white"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Satirical heuristic. Roast the code, not the coder.
        </footer>
      </main>
    </div>
  );
}
