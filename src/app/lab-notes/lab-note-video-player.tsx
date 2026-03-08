'use client'

import { Maximize, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

type LabNoteVideoPlayerProps = {
  src: string
  poster?: string
  width?: string
  label?: string
  className?: string
  loop?: boolean
}

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenElement?: Element
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

type IOSVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
}

const playVideo = async (video: HTMLVideoElement) => {
  try {
    await video.play()
  } catch {
    // Autoplay can be blocked even for muted video. Keep controls usable.
  }
}

export function LabNoteVideoPlayer({
  src,
  poster,
  width,
  label,
  className,
  loop = true,
}: LabNoteVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current

    if (!video || !container) {
      return
    }

    const updateState = () => {
      setIsPlaying(!video.paused && !video.ended)
    }

    updateState()
    video.addEventListener('play', updateState)
    video.addEventListener('pause', updateState)
    video.addEventListener('ended', updateState)

    if (typeof IntersectionObserver !== 'function') {
      void playVideo(video)
      return () => {
        video.removeEventListener('play', updateState)
        video.removeEventListener('pause', updateState)
        video.removeEventListener('ended', updateState)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          void playVideo(video)
          return
        }

        video.pause()
      },
      {
        threshold: [0, 0.5, 1],
      },
    )

    observer.observe(container)

    return () => {
      observer.disconnect()
      video.removeEventListener('play', updateState)
      video.removeEventListener('pause', updateState)
      video.removeEventListener('ended', updateState)
    }
  }, [])

  const togglePlay = async () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (video.paused || video.ended) {
      await playVideo(video)
      return
    }

    video.pause()
  }

  const toggleFullscreen = async () => {
    const container = containerRef.current as FullscreenElement | null
    const video = videoRef.current as IOSVideoElement | null
    const doc = document as FullscreenDocument

    if (!container) {
      return
    }

    const isFullscreen =
      doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null

    if (!isFullscreen) {
      if (typeof container.requestFullscreen === 'function') {
        try {
          await container.requestFullscreen()
          return
        } catch {
          // Fall through to prefixed/fullscreen fallback below.
        }
      }

      if (typeof container.webkitRequestFullscreen === 'function') {
        await container.webkitRequestFullscreen()
        return
      }

      video?.webkitEnterFullscreen?.()
      return
    }

    if (typeof doc.exitFullscreen === 'function') {
      try {
        await doc.exitFullscreen()
      } catch {
        // Ignore failures and leave the current state unchanged.
      }
      return
    }

    await doc.webkitExitFullscreen?.()
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative mx-auto w-full overflow-hidden rounded-[1.05rem] border border-white/10 bg-black/80 shadow-[0_24px_60px_rgba(0,0,0,0.28)]',
        className,
      )}
      style={width ? { maxWidth: width } : undefined}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop={loop}
        muted
        playsInline
        preload="metadata"
        aria-label={
          label ? `video preview: ${label}` : 'lab note video preview'
        }
        className="block h-auto w-full"
      >
        <track kind="captions" />
      </video>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.08),transparent_45%),radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.34)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 via-black/10 to-transparent" />

      {label ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-white/70 backdrop-blur-sm">
          {label}
        </div>
      ) : null}

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/65 px-2 py-1.5 text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="rounded-full p-1.5 transition-colors hover:text-white"
          aria-label={isPlaying ? 'pause video' : 'play video'}
        >
          {isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </button>
        <div className="h-4 w-px bg-white/15" />
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="rounded-full p-1.5 transition-colors hover:text-white"
          aria-label="toggle fullscreen"
        >
          <Maximize className="size-4" />
        </button>
      </div>
    </div>
  )
}
