export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">Loading nearby restaurants…</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="skeleton flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/5 rounded bg-stone-200 dark:bg-stone-700" />
            <div className="h-4 w-4/5 rounded bg-stone-200 dark:bg-stone-800" />
          </div>
          <div className="h-8 w-20 rounded-full bg-stone-200 dark:bg-stone-700" />
        </div>
      ))}
    </div>
  );
}
