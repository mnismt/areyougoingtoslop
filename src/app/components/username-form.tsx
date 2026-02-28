'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
      <label className="font-mono text-xs text-muted-foreground">
        GitHub username
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="octocat"
          className="h-12 flex-1 rounded-xl"
        />
        <Button type="submit" className="h-12 rounded-xl px-6">
          Score me
        </Button>
      </div>
      {error ? <p className="text-sm text-primary">{error}</p> : null}
    </form>
  )
}
