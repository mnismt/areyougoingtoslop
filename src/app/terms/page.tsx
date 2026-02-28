import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <Link
        href="/"
        className="font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        &larr; back
      </Link>

      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs text-muted-foreground">Terms</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Please keep it light.
        </h1>
      </header>

      <Card>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            areyougoingslop provides a satirical, heuristic score based on
            public GitHub activity. It is not a detector, proof, or professional
            analysis.
          </p>
          <p className="mt-4">
            Use this product for fun. Do not use it to make employment,
            compliance, or disciplinary decisions.
          </p>
          <p className="mt-4">
            We may update or remove leaderboard entries at our discretion,
            especially for abuse or removal requests.
          </p>
        </CardContent>
      </Card>

      <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
        <span>Built for screenshots, not courtrooms.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/feedback" className="hover:text-foreground">
            Feedback
          </Link>
          <Link href="/how-it-works" className="hover:text-foreground">
            How it works
          </Link>
        </div>
      </footer>
    </main>
  )
}
