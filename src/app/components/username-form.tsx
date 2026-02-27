'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const sanitizeUsername = (value: string) => value.trim().replace(/^@+/, '')

export default function UsernameForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleaned = sanitizeUsername(username)
    if (!cleaned) {
      setError("Drop a GitHub username and we'll do the rest.")
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
      <label className="font-mono text-xs text-[var(--muted)]">
        GitHub username
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="octocat"
          className="h-12 w-full flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-base text-[var(--foreground)] placeholder:text-gray-400 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
        />
        <button
          type="submit"
          className="h-12 rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Score me
        </button>
      </div>
      {error ? <p className="text-sm text-[var(--accent)]">{error}</p> : null}
    </form>
  )
}
