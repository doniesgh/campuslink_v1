export default function Loading() {
  return (
    <div className="container space-y-6 py-9" aria-busy="true">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
        <div className="size-14 animate-pulse rounded-full bg-muted" />
        <div className="h-7 w-56 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mx-auto h-11 max-w-sm animate-pulse rounded-full bg-muted" />
      <div className="mx-auto h-72 max-w-2xl animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
