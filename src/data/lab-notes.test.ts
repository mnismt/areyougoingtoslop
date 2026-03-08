import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getLabNoteAnchorId,
  getLatestVersionedLabNote,
  type LabNoteEntry,
  labNotes,
} from './lab-notes'

describe('labNotes media metadata', () => {
  it('keeps media-backed notes versioned and rooted in local assets', () => {
    const entries = labNotes as readonly LabNoteEntry[]
    const entriesWithMedia = entries.filter(
      (entry) => (entry.media?.length ?? 0) > 0,
    )

    assert.ok(entriesWithMedia.length > 0)

    for (const entry of entriesWithMedia) {
      assert.match(entry.version ?? '', /^v\d+\.\d+\.\d+$/)

      for (const item of entry.media ?? []) {
        assert.match(item.src, /^\/[a-z0-9/_\-.]+$/i)

        if (item.type === 'video' && item.poster) {
          assert.match(item.poster, /^\/[a-z0-9/_\-.]+$/i)
        }

        if (item.type === 'image') {
          assert.ok(item.alt.length > 0)
        }
      }
    }
  })

  it('returns the latest versioned note with a stable anchor id', () => {
    const latest = getLatestVersionedLabNote(labNotes)

    assert.equal(latest?.version, 'v0.0.2')
    assert.equal(latest ? getLabNoteAnchorId(latest) : null, 'note-v0-0-2')
  })
})
