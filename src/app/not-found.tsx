'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/site-footer'

const messages = [
  {
    headline: 'this page has been flagged for non-existence.',
    body: 'our model is 94% confident it was never written.',
    signal: 'confidence: absolute',
  },
  {
    headline: 'we asked the AI where this page went.',
    body: 'it apologized and hallucinated three alternatives instead.',
    signal: 'status: confidently wrong',
  },
  {
    headline: 'route not found. like your 3am commits,',
    body: 'this one simply ceased to exist by morning.',
    signal: 'last_seen: never',
  },
  {
    headline: 'our slop detector scanned every route.',
    body: "this URL scored a solid zero. even by our standards, that's impressive.",
    signal: 'slop_score: null · verdict: gone',
  },
  {
    headline: 'this page was committed, reverted,',
    body: 'and force-pushed into oblivion by an overeager LLM.',
    signal: 'cause: excessive refactoring',
  },
]

export default function NotFound() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(false)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    setIdx(Math.floor(Math.random() * messages.length))
    // stagger the message entrance after the number animates in
    const t = setTimeout(() => {
      setVisible(true)
      setEntered(true)
    }, 200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!entered) return
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % messages.length)
        setVisible(true)
      }, 450)
    }, 5500)
    return () => clearInterval(timer)
  }, [entered])

  const msg = messages[idx]

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-16">
      <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p
          className="font-mono text-xs text-muted-foreground uppercase tracking-widest animate-rise"
          style={{ animationDelay: '0ms' }}
        >
          signal: page_not_found
        </p>

        <h1
          className="text-8xl font-bold text-primary animate-rise"
          style={{ animationDelay: '80ms' }}
        >
          404
        </h1>

        <div
          className="flex flex-col gap-1 transition-all duration-500 ease-in-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(-6px)',
          }}
        >
          <p className="text-xl">{msg.headline}</p>
          <p className="text-xl text-muted-foreground">{msg.body}</p>
        </div>

        <p
          className="font-mono text-xs text-muted-foreground transition-all duration-500 ease-in-out"
          style={{
            opacity: visible ? 1 : 0,
            transitionDelay: visible ? '60ms' : '0ms',
          }}
        >
          {msg.signal}
        </p>

        <Link
          href="/"
          className="group relative font-mono text-sm text-primary mt-4 animate-rise"
          style={{ animationDelay: '320ms' }}
        >
          ← go home and inspect something real
          <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-primary transition-all duration-300 group-hover:w-full" />
        </Link>
      </section>

      <SiteFooter />
    </main>
  )
}
