import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
      <span>
        satirical heuristic &middot; built for screenshots, not courtrooms.
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/fine-print"
          className="group relative hover:text-foreground"
        >
          fine print
          <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-foreground transition-all duration-300 group-hover:w-full" />
        </Link>
        <Link
          href="/leaderboard"
          className="group relative hover:text-foreground"
        >
          leaderboard
          <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-foreground transition-all duration-300 group-hover:w-full" />
        </Link>
        <Link
          href="/ops/queue"
          className="group relative hover:text-foreground"
        >
          queue ops
          <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-foreground transition-all duration-300 group-hover:w-full" />
        </Link>
        <ThemeToggle />
      </div>
    </footer>
  )
}
