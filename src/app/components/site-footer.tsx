import { Github } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteFooter() {
  return (
    <footer className="flex flex-col gap-4 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
          href="/lab-notes"
          className="group relative hover:text-foreground"
        >
          lab notes
          <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-foreground transition-all duration-300 group-hover:w-full" />
        </Link>
        <Link
          href="/wallofshame"
          className="group relative hover:text-foreground"
        >
          wall of shame
          <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-foreground transition-all duration-300 group-hover:w-full" />
        </Link>
        <Link
          href="/ops/queue"
          className="group relative hover:text-foreground"
        >
          queue ops
          <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-foreground transition-all duration-300 group-hover:w-full" />
        </Link>
        <a
          href="https://github.com/mnismt/areyougoingtoslop"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
          aria-label="source code on github"
        >
          <Github className="h-4 w-4" />
        </a>
        <ThemeToggle />
      </div>
    </footer>
  )
}
