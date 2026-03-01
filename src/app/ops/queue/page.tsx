import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
import QueueLiveView from './queue-live-view'

export const metadata: Metadata = {
  title: 'queue ops',
  description:
    'live queue health for the redis-backed github request pipeline. probably fine.',
}

export default function QueueOpsPage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-16"
    >
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="back-link font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="back-arrow">&larr;</span> back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          queue observatory
        </h1>
        <p className="text-sm text-muted-foreground">
          yes, this is a real page. no, nothing is broken. the queue is just
          quietly doing its job while you nervously refresh.
        </p>
      </header>

      <QueueLiveView />

      <SiteFooter />
    </main>
  )
}
