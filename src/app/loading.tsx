export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-64 rounded-lg bg-surface-2" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-surface-2" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-surface" />)}
      </div>
    </div>
  );
}
