export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 animate-rise">
        <p className="font-mono text-xs text-[var(--muted)]">Calculating</p>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Scanning commit vibes... sniffing for copilot...
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`loading-${index}`}
            className="h-24 rounded-xl border border-[var(--border)] bg-[var(--card)] animate-rise"
            style={{ animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>
    </main>
  );
}
