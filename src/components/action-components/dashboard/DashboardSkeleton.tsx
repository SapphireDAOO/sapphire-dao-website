import { cn } from "@/lib/utils";

const Block = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-muted", className)} />
);

/** The dashboard's layout without data, shown while the wallet reconnects. */
const DashboardSkeleton = () => (
  <div
    className="flex min-h-screen flex-col bg-background"
    aria-busy="true"
    aria-label="Loading your dashboard"
  >
    <div className="flex-1 md:grid md:grid-cols-[minmax(0,1fr)_minmax(15rem,25%)]">
      <div className="min-w-0 px-4 pb-10 pt-5 sm:px-8 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Block className="h-9 w-72 max-w-full rounded-xl" />
          <Block className="h-9 w-40" />
        </div>
        <Block className="mt-4 h-10 w-full rounded-lg md:hidden" />

        <div className="mt-6 space-y-4 md:mt-8">
          <Block className="h-6 w-40" />
          <Block className="h-14 w-56" />
          <Block className="h-4 w-24" />
        </div>

        <div className="-mx-4 mt-6 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:px-0">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-[5.5rem] min-w-[8.5rem] flex-1 border border-border bg-card p-3"
            >
              <Block className="h-2.5 w-20" />
              <Block className="mt-5 h-5 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <Block className="h-9 w-64 max-w-full rounded-xl" />
          <Block className="h-9 w-32 rounded-xl" />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex justify-between border border-border bg-card p-5"
            >
              <div className="space-y-3">
                <Block className="h-5 w-44" />
                <Block className="h-3 w-32" />
              </div>
              <div className="flex flex-col items-end space-y-3">
                <Block className="h-5 w-20" />
                <Block className="h-3 w-14" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="hidden border-l border-border md:block md:px-4 md:py-8 lg:px-7">
        <Block className="h-11 w-full rounded-lg" />
        <div className="mt-5 border border-border bg-card p-4">
          <Block className="h-3 w-32" />
          <Block className="mt-3 h-6 w-20" />
        </div>
      </aside>
    </div>
  </div>
);

export default DashboardSkeleton;
