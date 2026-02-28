import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import FeedbackForm from './feedback-form'

export default function FeedbackPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        &larr; back
      </Link>

      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs text-muted-foreground">Feedback</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Help us tune the roast.
        </h1>
        <p className="text-sm text-muted-foreground">
          We are calibrating the model. Tell us what feels off, what is spot on,
          and what to improve next.
        </p>
      </header>

      <Card>
        <CardContent>
          <FeedbackForm />
        </CardContent>
      </Card>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
        <span>Built for screenshots, not courtrooms.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  )
}
