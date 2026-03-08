import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'
import { LabNotesLedger } from '@/app/lab-notes/lab-notes-view'
import { labNotes } from '@/data/lab-notes'

export const metadata: Metadata = {
  title: 'lab notes',
  description:
    'a running record of shipped changes, revised suspicions, and controlled mistakes.',
}

export default function LabNotesPage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-16"
    >
      <header className="flex flex-col gap-4 animate-rise">
        <Link
          href="/"
          className="back-link w-fit font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="back-arrow">&larr;</span> back
        </Link>
      </header>

      <LabNotesLedger entries={labNotes} />

      <SiteFooter />
    </main>
  )
}
