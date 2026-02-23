export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-16">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 animate-rise">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Calculating
        </p>
        <p className="mt-4 text-lg text-white/70">
          Inspecting commit vibes, brewing the roast...
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`loading-${index}`}
            className="h-24 rounded-3xl border border-white/10 bg-white/5 animate-rise"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
    </main>
  );
}
