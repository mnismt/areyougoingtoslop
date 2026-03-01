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
  const description = `we checked @${username}'s github commits for signs of ai slop. the results are in.`

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
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-6 py-6 sm:gap-8 sm:py-16"
    >
      <Link
        href="/"
        className="back-link font-mono text-sm text-muted-foreground hover:text-foreground"
      >
        <span className="font-bold text-foreground">areyougoingslop</span>
        <span className="ml-2 text-xs">
          <span className="back-arrow">&larr;</span> back
        </span>
      </Link>
      <ScoreLiveView username={username} />
    </main>
  )
}
