import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
import QueueLiveView from './queue-live-view'

export const metadata: Metadata = {
  title: 'Queue Ops',
  description:
    'Live queue health for the Redis-backed GitHub request pipeline.',
}

export default function QueueOpsPage() {
  return (
    <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="back-link font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="back-arrow">&larr;</span> back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Queue Observatory
        </h1>
        <p className="text-sm text-muted-foreground">
          Public read-only telemetry for the GitHub request queue. No payloads,
          just operational vitals.
        </p>
      </header>

      <QueueLiveView />

      <SiteFooter />
    </main>
  )
}
