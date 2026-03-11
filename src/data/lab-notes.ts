export type LabNoteTag = 'feature' | 'fix' | 'experiment' | 'adjustment'

export type LabNoteMedia =
  | {
      type: 'video'
      src: string
      poster?: string
      width?: string
      label?: string
    }
  | {
      type: 'image'
      src: string
      alt: string
      width?: string
    }

export type LabNoteEntry = {
  date: string
  title: string
  note?: string
  tag: LabNoteTag
  version?: string
  commitHashes?: readonly string[]
  media?: readonly LabNoteMedia[]
}

const slugifyLabNoteToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const labNotes = [
  {
    date: '2026-03-11',
    tag: 'feature',
    version: 'v0.0.3',
    title: 'the slop heatmap arrived',
    note: 'one score was too subtle. now there is a full calendar showing exactly when the prompt residue started to cluster and how comfortable it got.',
    media: [
      {
        type: 'video',
        src: '/changelogs/slop-v0.0.3.mp4',
        width: '920px',
        label: 'calendar of concern',
      },
    ],
  },
  {
    date: '2026-03-08',
    tag: 'feature',
    version: 'v0.0.2',
    title: 'search got faster, and the tooling got more involved',
    note: 'the input now focuses itself and submits on enter. the repo also picked up a browser automation skill, which felt consistent with the larger situation.',
    commitHashes: ['a149717', 'f5765c2'],
    media: [
      {
        type: 'video',
        src: '/changelogs/slop-v0.0.2.mp4',
        width: '920px',
        label: 'latest commit reel',
      },
    ],
  },
  {
    date: '2026-03-07',
    tag: 'feature',
    title: 'the total analyzed counter now survives a restart',
    note: 'redis has been asked to remember how many profiles have passed through here. it agreed.',
    commitHashes: ['6204006'],
  },
  {
    date: '2026-03-04',
    tag: 'fix',
    title: 'wall of shame cards stopped misbehaving on mobile',
    note: 'less overflow, less clipped layout, same level of public judgment.',
    commitHashes: ['e496bbe'],
  },
  {
    date: '2026-03-03',
    tag: 'feature',
    title: 'the leaderboard became the wall of shame',
    note: 'same ranking, more accurate branding, permanent redirect included for anyone attached to the old euphemism.',
    commitHashes: ['8e448fa'],
  },
  {
    tag: 'feature',
    date: '2026-03-03',
    title: 'commit inspection widened from 120 and 200 up to 500',
    note: 'if we were going to be unfair, the least we could do was gather more evidence first.',
    commitHashes: ['cd72368'],
  },
  {
    date: '2026-03-03',
    tag: 'feature',
    version: 'v0.0.1',
    title: 'initial release',
    note: 'the site went public. no campaign, no launch video, just a url and enough confidence to start scoring strangers in public.',
  },
] satisfies readonly LabNoteEntry[]

export const getLatestVersionedLabNote = (
  entries: readonly LabNoteEntry[] = labNotes,
) => entries.find((entry) => entry.version)

export const getLabNoteAnchorId = (
  entry: Pick<LabNoteEntry, 'date' | 'title' | 'version'>,
) => {
  if (entry.version) {
    return `note-${slugifyLabNoteToken(entry.version)}`
  }

  return `note-${slugifyLabNoteToken(`${entry.date}-${entry.title}`)}`
}
