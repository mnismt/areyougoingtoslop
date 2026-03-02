'use client'

import { useState } from 'react'
import { RedditIcon } from '@/components/icons/reddit'
import { XIcon } from '@/components/icons/x'
import { Button } from '@/components/ui/button'
import { pickShareMessage } from './share-message'

type ShareActionsProps = {
  username: string
}

const copyToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

const shareButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-muted text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function ShareActions({ username }: ShareActionsProps) {
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle')

  const url = `https://areyougoingtoslop.com/u/${username}`
  const shareText = pickShareMessage(username)

  const handleCopy = async () => {
    try {
      await copyToClipboard(url)
      setCopyState('done')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        onClick={handleCopy}
        className="font-mono text-xs"
      >
        {copyState === 'done'
          ? 'copied!'
          : copyState === 'error'
            ? 'copy failed'
            : 'copy receipt'}
      </Button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            window.open(
              `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
              '_blank',
              'noopener,noreferrer,width=600,height=600',
            )
          }
          className={shareButtonClass}
          aria-label="share on x"
        >
          <XIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            window.open(
              `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(shareText)}`,
              '_blank',
              'noopener,noreferrer,width=600,height=600',
            )
          }
          className={shareButtonClass}
          aria-label="share on reddit"
        >
          <RedditIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
