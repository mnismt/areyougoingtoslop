import { ArrowRight } from 'lucide-react'
import { getLabNoteAnchorId, type LabNoteEntry } from '../../data/lab-notes'

export function LatestReleaseHint({ entry }: { entry?: LabNoteEntry }) {
  if (!entry?.version) {
    return null
  }

  const teaser = entry.title.split(',')[0] ?? entry.title

  return (
    <a
      href={`/lab-notes#${getLabNoteAnchorId(entry)}`}
      className="group inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center transition-colors hover:text-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-primary/75" />
        <span className="font-mono text-[11px] text-foreground/85 transition-colors group-hover:text-primary">
          lab notes
        </span>
      </span>
      <span className="font-mono text-[11px] text-foreground/70">
        {entry.version}
      </span>
      <span className="text-xs text-muted-foreground">&mdash; {teaser}</span>
      <span className="text-muted-foreground/60 transition-colors group-hover:text-foreground/80">
        <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
    </a>
  )
}
