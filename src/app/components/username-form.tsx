'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const sanitizeUsername = (value: string) => value.trim().replace(/^@+/, '')

export default function UsernameForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        document.activeElement === inputRef.current ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.length !== 1
      ) {
        return
      }
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleaned = sanitizeUsername(username)
    if (!cleaned) {
      setError('we need a username. snitching requires specificity.')
      return
    }
    setError('')
    router.push(`/u/${cleaned}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-2 text-left"
    >
      <label
        htmlFor="username-input"
        className="font-mono text-xs text-muted-foreground"
      >
        suspect
      </label>
      <div className="relative flex items-center rounded-xl border border-input bg-transparent shadow-xs transition-[border-color,box-shadow] duration-200 ease-out focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] dark:bg-input/30">
        <Input
          ref={inputRef}
          id="username-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              const cleaned = sanitizeUsername(username)
              if (!cleaned) {
                setError('we need a username. snitching requires specificity.')
                return
              }
              setError('')
              router.push(`/u/${cleaned}`)
            }
          }}
          placeholder="e.g. your coworker"
          className="h-12 flex-1 border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 focus-visible:border-0"
          autoComplete="off"
        />
        <Button type="submit" className="m-1.5 h-9 shrink-0 rounded-lg px-4 text-sm sm:px-6">
          inspect the vibes
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-primary">
          {error}
        </p>
      ) : null}
    </form>
  )
}
