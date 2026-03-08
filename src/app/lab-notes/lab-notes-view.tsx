import { ArrowUpRight } from 'lucide-react'
import Image from 'next/image'
import {
  getLabNoteAnchorId,
  type LabNoteEntry,
  type LabNoteMedia,
} from '../../data/lab-notes'
import { LabNoteVideoPlayer } from './lab-note-video-player'

const repoUrl = 'https://github.com/mnismt/areyougoingtoslop'
const launchDate = '2026-03-03'

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))

const groupLabNotesByDate = (entries: readonly LabNoteEntry[]) =>
  entries.reduce<Array<{ date: string; entries: LabNoteEntry[] }>>(
    (groups, entry) => {
      const group = groups.at(-1)

      if (group && group.date === entry.date) {
        group.entries.push(entry)
        return groups
      }

      groups.push({
        date: entry.date,
        entries: [entry],
      })

      return groups
    },
    [],
  )

const commitLink = (hash: string) => `${repoUrl}/commit/${hash}`

function CommitLinks({ hashes }: { hashes: readonly string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>commit</span>
      {hashes.map((hash, hashIndex) => (
        <span key={hash} className="inline-flex items-center gap-1">
          {hashIndex > 0 ? (
            <span>{hashIndex === hashes.length - 1 ? 'and' : ','}</span>
          ) : null}
          <a
            href={commitLink(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            aria-label={`open commit ${hash}`}
          >
            [{hash.slice(0, 7)}]
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </span>
      ))}
    </span>
  )
}

function LabNoteMediaGallery({ media }: { media: readonly LabNoteMedia[] }) {
  return (
    <div className="mt-4 grid gap-3">
      {media.map((item, index) => {
        if (item.type === 'video') {
          return (
            <LabNoteVideoPlayer
              key={`${item.type}-${item.src}-${index}`}
              src={item.src}
              poster={item.poster}
              width={item.width}
              label={item.label}
            />
          )
        }

        return (
          <figure
            key={`${item.type}-${item.src}-${index}`}
            className="relative mx-auto w-full overflow-hidden rounded-[1.05rem] border border-border/70 bg-[linear-gradient(180deg,rgba(23,23,23,0.08),rgba(23,23,23,0.14))] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.08)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]"
            style={item.width ? { maxWidth: item.width } : undefined}
          >
            <Image
              src={item.src}
              alt={item.alt}
              width={1600}
              height={900}
              className="block h-auto w-full rounded-[0.8rem] border border-border/60 bg-background object-cover"
            />
          </figure>
        )
      })}
    </div>
  )
}

export function LabNotesLedger({
  entries,
}: {
  entries: readonly LabNoteEntry[]
}) {
  const dateGroups = groupLabNotesByDate(entries)
  const linkedCommitCount = new Set(
    entries.flatMap((entry) => entry.commitHashes ?? []),
  ).size
  const latestEntryDate = entries[0]?.date ?? launchDate

  return (
    <>
      <div className="flex flex-col gap-3 animate-rise">
        <p className="font-mono text-xs text-muted-foreground">
          public release log / dated to when things actually shipped
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          the lab notes
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          a running record of shipped changes, revised suspicions, and
          controlled mistakes. commit-backed where possible. no historical
          fiction.
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border border-border bg-card/70 p-4 animate-rise sm:grid-cols-3 sm:p-5">
        <div className="grid gap-1">
          <span className="font-mono text-[11px] text-muted-foreground">
            entries on file
          </span>
          <span className="text-2xl font-semibold">{entries.length}</span>
        </div>
        <div className="grid gap-1">
          <span className="font-mono text-[11px] text-muted-foreground">
            linked commits
          </span>
          <span className="text-2xl font-semibold">{linkedCommitCount}</span>
        </div>
        <div className="grid gap-1">
          <span className="font-mono text-[11px] text-muted-foreground">
            public since
          </span>
          <span className="text-2xl font-semibold">
            {formatDate(launchDate)}
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card/50 animate-rise animate-delay-1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3 font-mono text-[11px] text-muted-foreground sm:px-6">
          <span>reverse chronological log</span>
          <span>latest note {formatDate(latestEntryDate)}</span>
        </div>

        <div className="divide-y divide-border/80">
          {dateGroups.map((group, groupIndex) => (
            <div
              key={group.date}
              className="grid gap-4 px-4 py-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:px-6"
            >
              <div className="font-mono text-xs text-muted-foreground">
                {formatDate(group.date)}
              </div>

              <div className="grid gap-3">
                {group.entries.map((entry, entryIndex) => (
                  <article
                    key={`${entry.date}-${entry.title}`}
                    id={getLabNoteAnchorId(entry)}
                    style={{
                      animationDelay: `${120 + groupIndex * 120 + entryIndex * 70}ms`,
                    }}
                    className="card-lift group scroll-mt-24 rounded-xl border border-border/70 bg-background/30 px-4 py-4 animate-rise"
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <span>[{entry.tag}]</span>
                      {entry.version ? (
                        <span className="inline-flex items-center rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-foreground/80">
                          {entry.version}
                        </span>
                      ) : null}
                      {entry.commitHashes?.length ? (
                        <>
                          <CommitLinks hashes={entry.commitHashes} />
                          <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-primary">
                            generated by ai
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-2">
                      <h2 className="max-w-2xl text-lg font-medium tracking-[-0.02em] text-foreground sm:text-[1.2rem]">
                        {entry.commitHashes?.[0] ? (
                          <a
                            href={commitLink(entry.commitHashes[0])}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-primary"
                          >
                            {entry.title}
                          </a>
                        ) : (
                          entry.title
                        )}
                      </h2>
                      {entry.note ? (
                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>

                    {entry.media?.length ? (
                      <LabNoteMediaGallery media={entry.media} />
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
