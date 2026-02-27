'use client'

import { useState } from 'react'

export default function FeedbackForm() {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!message.trim()) {
      setStatus('error')
      return
    }
    setStatus('sending')
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!response.ok) {
        throw new Error('Failed')
      }
      setMessage('')
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4 text-left"
    >
      <label className="font-mono text-xs text-[var(--muted)]">
        Your feedback
      </label>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={5}
        placeholder="Tell us what felt fair, what felt off, and what to fix next."
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-gray-400 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
      />
      <button
        type="submit"
        className="h-11 rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:opacity-90"
      >
        {status === 'sending'
          ? 'Sending...'
          : status === 'sent'
            ? 'Thanks!'
            : 'Send feedback'}
      </button>
      {status === 'error' ? (
        <p className="text-xs text-[var(--accent)]">
          Something went wrong. Try again.
        </p>
      ) : null}
    </form>
  )
}
