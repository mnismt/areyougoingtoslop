import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import SlopGauge from '../../components/slop-gauge'
import ShareActions from './share-actions'

type ScoreResponse = {
  slop_score: number
  tier: string
  confidence: 'low' | 'medium' | 'high'
  top_signals: string[]
  scoring_window: string
}

const fetchScore = async (username: string) => {
  const requestHeaders = await headers()
  const host = requestHeaders.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const response = await fetch(`${protocol}://${host}/api/score/${username}`, {
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null)
  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> => {
  const { username } = await params
  const requestHeaders = await headers()
  const host = requestHeaders.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const title = `@${username} | areyougoingslop`
  const description =
    "A playful, transparent heuristic for how AI-assisted a GitHub user's public contributions look."
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${protocol}://${host}/u/${username}`,
      images: [`/api/og/${username}`],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/${username}`],
    },
  }
}

const confidenceStyles: Record<ScoreResponse['confidence'], string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-amber-50 text-amber-600',
  high: 'bg-[var(--accent-soft)] text-[var(--accent)]',
}

const scoreColorClass = (score: number) => {
  if (score <= 30) return 'border-score-low'
  if (score <= 70) return 'border-score-mid'
  return 'border-score-high'
}

const ErrorState = ({
  title,
  description,
}: {
  title: string
  description: string
}) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-left">
    <p className="font-mono text-xs text-[var(--muted)]">{title}</p>
    <p className="mt-4 text-sm text-[var(--muted)]">{description}</p>
    <Link
      href="/"
      className="mt-6 inline-flex rounded-lg border border-[var(--border)] px-4 py-2 font-mono text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
    >
      Try another
    </Link>
  </div>
)

export default async function UserScorePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const { ok, status, payload } = await fetchScore(username)

  if (!ok || !payload) {
    if (status === 404) {
      return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
          <ErrorState
            title="User not found"
            description="We couldn't find that GitHub account. Double-check the spelling and try again."
          />
        </main>
      )
    }
    if (status === 429) {
      return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
          <ErrorState
            title="Rate limited"
            description="GitHub asked us to slow down. Give it a minute and re-run the score."
          />
        </main>
      )
    }
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
        <ErrorState
          title="Score unavailable"
          description="We couldn't compute a score right now. Try again later."
        />
      </main>
    )
  }

  const data = payload as ScoreResponse
  const hasLowSignal = data.top_signals.some((signal) =>
    signal.toLowerCase().includes('low signal'),
  )

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← back
      </Link>

      <section
        id="share-card"
        className="flex flex-col gap-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 animate-rise"
      >
        <div className="flex items-center gap-4">
          <Image
            src={`https://github.com/${username}.png`}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-full bg-gray-100"
            unoptimized
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold sm:text-3xl">@{username}</h1>
            <p className="font-mono text-sm text-[var(--muted)]">{data.tier}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-8 md:flex-row">
          <SlopGauge score={data.slop_score} />
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-lg px-3 py-1 font-mono text-xs ${confidenceStyles[data.confidence]}`}
              >
                {data.confidence} confidence
              </span>
              <span className="rounded-lg border border-[var(--border)] px-3 py-1 font-mono text-xs text-[var(--muted)]">
                {data.scoring_window}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Confidence reflects the volume of recent public activity and the
              amount of commit stats we can verify.
            </p>
            <p className="text-sm text-[var(--muted)]">
              We rank the surface-level signals in public activity. The score is
              a playful heuristic, not a definitive detector.
            </p>
            {hasLowSignal ? (
              <div className="rounded-lg border border-[var(--border)] bg-gray-50 p-4 text-sm text-[var(--muted)]">
                Not enough recent activity to lean on. Try again after a few
                public commits.
              </div>
            ) : null}
            <ShareActions username={username} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {data.top_signals.map((signal) => (
          <div
            key={signal}
            className={`rounded-xl border border-[var(--border)] border-l-4 ${scoreColorClass(data.slop_score)} bg-[var(--card)] p-5 text-sm text-[var(--muted)] animate-rise animate-delay-1`}
          >
            {signal}
          </div>
        ))}
      </section>

      <p className="font-mono text-xs text-[var(--muted)] text-center">
        Satirical heuristic, not proof. Roast the behavior, not the person.
      </p>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[var(--muted)]">
        <span>Built for screenshots, not courtrooms.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/how-it-works" className="hover:text-[var(--foreground)]">
            How it works
          </Link>
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
  )
}
