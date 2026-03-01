import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
      <span>
        satirical heuristic &middot; built for screenshots, not courtrooms.
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/fine-print" className="hover:text-foreground">
          fine print
        </Link>
        <Link href="/leaderboard" className="hover:text-foreground">
          leaderboard
        </Link>
        <Link href="/ops/queue" className="hover:text-foreground">
          queue ops
        </Link>
        <ThemeToggle />
      </div>
    </footer>
  )
}
