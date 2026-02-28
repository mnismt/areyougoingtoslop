import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import ScoreLiveView from './score-live-view'

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

export default async function UserScorePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        &larr; back
      </Link>
      <ScoreLiveView username={username} />
    </main>
  )
}
