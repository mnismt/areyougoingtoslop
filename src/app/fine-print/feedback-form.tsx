'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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
      <label className="font-mono text-xs text-muted-foreground">
        tell us what felt off, what was spot on, or just yell into the void
      </label>
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={5}
        placeholder="your score was mass injustice because..."
        className="rounded-xl"
      />
      <Button type="submit" className="h-11 rounded-xl">
        {status === 'sending'
          ? 'Transmitting grievance...'
          : status === 'sent'
            ? 'Duly noted.'
            : 'Send it'}
      </Button>
      {status === 'error' ? (
        <p className="text-xs text-primary">
          The void rejected your message. Try again.
        </p>
      ) : null}
    </form>
  )
}
