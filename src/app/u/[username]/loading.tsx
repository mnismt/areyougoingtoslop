import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-6 sm:gap-8 sm:py-16">
      <div className="rounded-xl border border-border bg-card p-5 animate-rise">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 animate-rise">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
          <Skeleton className="h-36 w-full max-w-[180px] self-center rounded-xl sm:self-auto" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {['one', 'two', 'three'].map((slot) => (
          <Skeleton key={`loading-${slot}`} className="h-24 rounded-xl" />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 animate-rise">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 flex flex-col gap-3">
          {['a', 'b', 'c'].map((slot) => (
            <Skeleton
              key={`commit-${slot}`}
              className="h-20 w-full rounded-lg"
            />
          ))}
        </div>
      </div>
    </main>
  )
}
