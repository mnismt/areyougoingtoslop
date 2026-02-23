import Link from "next/link";
import { headers } from "next/headers";

type ScoreResponse = {
  slop_score: number;
  tier: string;
  confidence: "low" | "medium" | "high";
  top_signals: string[];
  scoring_window: string;
};

const fetchScore = async (username: string) => {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const response = await fetch(`${protocol}://${host}/api/score/${username}`, {
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
};

const confidenceStyles: Record<ScoreResponse["confidence"], string> = {
  low: "bg-white/10 text-white/60",
  medium: "bg-[#ffe0c21f] text-[#ffe0c2]",
  high: "bg-[#f15a2926] text-[#f15a29]",
};

const ScoreGauge = ({ score }: { score: number }) => {
  const angle = Math.round((score / 100) * 360);
  return (
    <div className="relative h-44 w-44">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#f15a29 ${angle}deg, rgba(255,255,255,0.08) 0deg)`,
        }}
      />
      <div className="absolute inset-3 rounded-full bg-[#0b0a08] shadow-[0_0_40px_rgba(241,90,41,0.25)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">
          Slop Score
        </p>
        <p className="text-4xl font-semibold text-white">{score}</p>
      </div>
    </div>
  );
};

const ErrorState = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-left">
    <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
      {title}
    </p>
    <p className="mt-4 text-sm text-white/70">{description}</p>
    <Link
      href="/"
      className="mt-6 inline-flex rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40 hover:text-white"
    >
      Try another
    </Link>
  </div>
);

export default async function UserScorePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { ok, status, payload } = await fetchScore(username);

  if (!ok || !payload) {
    if (status === 404) {
      return (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-16">
          <ErrorState
            title="User not found"
            description="We couldn’t find that GitHub account. Double-check the spelling and try again."
          />
        </main>
      );
    }
    if (status === 429) {
      return (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-16">
          <ErrorState
            title="Rate limited"
            description="GitHub asked us to slow down. Give it a minute and re-run the score."
          />
        </main>
      );
    }
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-16">
        <ErrorState
          title="Score unavailable"
          description="We couldn’t compute a score right now. Try again later."
        />
      </main>
    );
  }

  const data = payload as ScoreResponse;
  const hasLowSignal = data.top_signals.some((signal) =>
    signal.toLowerCase().includes("low signal"),
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f15a291f,transparent_40%),radial-gradient(circle_at_80%_80%,#ffe0c233,transparent_35%),linear-gradient(160deg,#0b0a08_0%,#14100c_55%,#0b0a08_100%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]"
        >
          ← back
        </Link>

        <section className="flex flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur animate-rise">
          <div className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              @{username}
            </p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              {data.tier}
            </h1>
          </div>

          <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
            <ScoreGauge score={data.slop_score} />
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em]">
                <span
                  className={`rounded-full px-3 py-1 ${confidenceStyles[data.confidence]}`}
                >
                  {data.confidence} confidence
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-white/60">
                  {data.scoring_window}
                </span>
              </div>
              <p className="text-sm text-white/70">
                We rank the surface-level signals in public activity. The score
                is a playful heuristic, not a definitive detector.
              </p>
              {hasLowSignal ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  Not enough recent activity to lean on. Try again after a few
                  public commits.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {data.top_signals.map((signal) => (
            <div
              key={signal}
              className="rounded-3xl border border-white/10 bg-[#15120f] p-6 text-sm text-white/70 animate-rise animate-delay-1"
            >
              {signal}
            </div>
          ))}
        </section>

        <footer className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Satirical heuristic. Roast the code, not the coder.
        </footer>
      </main>
    </div>
  );
}
