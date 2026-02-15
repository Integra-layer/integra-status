export default function Loading() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header skeleton */}
      <div className="border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-neutral-200 animate-pulse" />
          <div className="h-6 w-48 rounded bg-neutral-200 animate-pulse" />
        </div>
      </div>
      {/* Summary bar skeleton */}
      <div className="sticky top-0 z-40 border-b px-6 py-3 bg-white/70 backdrop-blur-xl">
        <div className="flex gap-3">
          <div className="h-8 w-32 rounded-full bg-neutral-200 animate-pulse" />
          <div className="h-8 w-28 rounded-full bg-neutral-200 animate-pulse" />
          <div className="h-8 w-24 rounded-full bg-neutral-200 animate-pulse" />
        </div>
      </div>
      {/* Cards skeleton */}
      <div className="px-6 py-8 space-y-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <div className="h-5 w-40 rounded bg-neutral-200 animate-pulse" />
            <div className="space-y-2">
              {[...Array(4)].map((_, j) => (
                <div
                  key={j}
                  className="h-16 rounded-lg bg-neutral-100 animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
