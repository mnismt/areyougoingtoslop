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
  const description = `We checked @${username}'s GitHub commits for signs of AI slop. The results are in.`

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
        className="font-mono text-sm text-muted-foreground hover:text-foreground"
      >
        <span className="font-bold text-foreground">areyougoingslop</span>
        <span className="ml-2 text-xs">&larr; back</span>
      </Link>
      <ScoreLiveView username={username} />
    </main>
  )
}
