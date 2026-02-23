"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const sanitizeUsername = (value: string) =>
  value.trim().replace(/^@+/, "");

export default function UsernameForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = sanitizeUsername(username);
    if (!cleaned) {
      setError("Drop a GitHub username and we’ll do the rest.");
      return;
    }
    setError("");
    router.push(`/u/${cleaned}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 text-left"
    >
      <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
        GitHub Username
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="octocat"
          className="h-12 w-full flex-1 rounded-full border border-white/10 bg-white/5 px-5 text-base text-white/90 placeholder:text-white/35 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(241,90,41,0.35)]"
        />
        <button
          type="submit"
          className="h-12 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold uppercase tracking-[0.2em] text-black transition hover:translate-y-[-1px] hover:shadow-[0_14px_40px_rgba(241,90,41,0.35)]"
        >
          Score Me
        </button>
      </div>
      {error ? (
        <p className="text-sm text-[var(--accent-soft)]">{error}</p>
      ) : null}
    </form>
  );
}
