'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AnalyzedCommit } from './score-live-view'

const PAGE_SIZE = 20

const flagLabels: Record<string, string> = {
  ai_keyword: 'AI attribution hint',
  prompt_crumb: 'prompt crumb',
  large_generic: 'lazy message',
  high_churn: 'churn storm',
}

function pageWindow(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = [1]

  if (current > 3) pages.push('ellipsis')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('ellipsis')

  pages.push(total)
  return pages
}

export default function CommitList({ commits }: { commits: AnalyzedCommit[] }) {
  const [page, setPage] = useState(1)
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  const filtered = showFlaggedOnly
    ? commits.filter((c) => c.flags.length > 0)
    : commits
  const flaggedCount = commits.filter((c) => c.flags.length > 0).length
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageCommits = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  const goToPage = (p: number) => {
    setPage(p)
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <section
      ref={sectionRef}
      className="rounded-xl border border-border bg-card p-6 animate-rise animate-delay-1"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant={showFlaggedOnly ? 'ghost' : 'secondary'}
            size="xs"
            className="font-mono text-xs"
            onClick={() => {
              setShowFlaggedOnly(false)
              setPage(1)
            }}
          >
            All ({commits.length})
          </Button>
          <Button
            variant={showFlaggedOnly ? 'secondary' : 'ghost'}
            size="xs"
            className="font-mono text-xs"
            onClick={() => {
              setShowFlaggedOnly(true)
              setPage(1)
            }}
          >
            <span className="inline-block size-1.5 rounded-full bg-amber-500" />
            Flagged ({flaggedCount})
          </Button>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {rangeStart}&ndash;{rangeEnd} of {filtered.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm italic text-muted-foreground">
          No flagged commits found. Squeaky clean — or suspiciously good at
          covering tracks.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pageCommits.map((commit) => (
            <div
              key={`${commit.repo}:${commit.sha}`}
              className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://github.com/${commit.repo}/commit/${commit.sha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary hover:underline"
                  aria-label={`View commit ${commit.sha.slice(0, 7)} on GitHub (opens in new tab)`}
                >
                  {commit.sha.slice(0, 7)}
                </a>
                <span className="font-mono text-xs text-muted-foreground">
                  {commit.repo}
                </span>
                {commit.additions !== undefined && (
                  <span className="font-mono text-xs text-green-600 dark:text-green-400">
                    +{commit.additions}
                  </span>
                )}
                {commit.deletions !== undefined && (
                  <span className="font-mono text-xs text-red-500 dark:text-red-400">
                    &minus;{commit.deletions}
                  </span>
                )}
                {commit.flags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    {flagLabels[flag] ?? flag}
                  </span>
                ))}
              </div>
              <p className="break-words text-sm text-foreground">
                {commit.message || (
                  <span className="italic text-muted-foreground">
                    (no message)
                  </span>
                )}
              </p>
              <span className="font-mono text-[10px] text-muted-foreground">
                {new Date(commit.occurred_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={safePage <= 1}
            onClick={() => goToPage(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          {pageWindow(safePage, totalPages).map((entry, i) =>
            entry === 'ellipsis' ? (
              <span
                key={`ellipsis-${i}`}
                className="px-1 font-mono text-xs text-muted-foreground"
              >
                ...
              </span>
            ) : (
              <Button
                key={entry}
                variant={entry === safePage ? 'secondary' : 'ghost'}
                size="icon-xs"
                className="font-mono text-xs"
                onClick={() => goToPage(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === safePage ? 'page' : undefined}
              >
                {entry}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={safePage >= totalPages}
            onClick={() => goToPage(safePage + 1)}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </section>
  )
}
