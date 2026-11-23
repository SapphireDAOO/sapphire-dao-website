"use client";

import { cn } from "@/lib/utils";
import {
  ALL_GROUP_ID,
  TONE_DOT,
  type StatusGroup,
} from "./statusGroups";

export type GroupStats = { count: number; total: bigint };

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-background p-1"
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border px-2.5 text-xs font-medium transition-colors",
            active
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

const pluralInvoices = (count: number) =>
  `${count} ${count === 1 ? "invoice" : "invoices"}`;

export const StatusHero = ({
  group,
  stats,
  formatTotal,
  unit,
  secondary,
  isLoading,
}: {
  group: StatusGroup;
  stats?: GroupStats;
  formatTotal: (value: bigint) => string;
  unit: string;
  secondary?: string;
  isLoading: boolean;
}) => {
  const isAll = group.id === ALL_GROUP_ID;
  return (
    <section aria-labelledby="selected-status-title">
      <div className="flex items-center gap-2.5">
        <span
          className={cn("size-3 shrink-0 rounded-full", TONE_DOT[group.tone])}
          aria-hidden="true"
        />
        <h1
          id="selected-status-title"
          className="truncate text-lg font-semibold tracking-tight sm:text-xl"
        >
          {group.label}
        </h1>
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="break-all font-mono text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
          {isLoading || !stats
            ? "—"
            : isAll
              ? stats.count
              : formatTotal(stats.total)}
        </span>
        <span className="text-base font-medium text-muted-foreground sm:text-lg">
          {isAll ? (stats?.count === 1 ? "invoice" : "invoices") : unit}
        </span>
      </div>
      {!isAll && (
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          {isLoading || !stats
            ? "Counting invoices…"
            : pluralInvoices(stats.count)}
          {secondary && !isLoading && (
            <span className="font-normal"> · {secondary}</span>
          )}
        </p>
      )}
    </section>
  );
};

export const StatusTiles = ({
  groups,
  selectedId,
  stats,
  formatTotal,
  unit,
  isLoading,
  onSelect,
}: {
  groups: StatusGroup[];
  selectedId: string;
  stats: Record<string, GroupStats>;
  formatTotal: (value: bigint) => string;
  unit: string;
  isLoading: boolean;
  onSelect: (id: string) => void;
}) => {
  const tiles = groups.filter((group) => group.id !== selectedId);
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div
        role="group"
        aria-label="Choose a status"
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${tiles.length}, minmax(8.5rem, 1fr))`,
        }}
      >
        {tiles.map((group) => {
          const stat = stats[group.id];
          const isAll = group.id === ALL_GROUP_ID;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className="border border-border bg-card px-3 py-3.5 text-left shadow-sm outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-start gap-1.5">
                  <span
                    className={cn(
                      "mt-1 size-1.5 shrink-0 rounded-full",
                      TONE_DOT[group.tone],
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-medium uppercase leading-snug tracking-tight text-muted-foreground">
                    {group.label}
                  </span>
                </span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                  {isLoading || !stat ? "–" : stat.count}
                </span>
              </div>
              <div className="mt-3 flex min-h-7 items-baseline gap-1.5">
                {isAll ? (
                  <>
                    <span className="font-mono text-xl font-semibold tracking-tight tabular-nums">
                      {isLoading || !stat ? "—" : stat.count}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {stat?.count === 1 ? "invoice" : "invoices"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-xl font-semibold tracking-tight tabular-nums">
                      {isLoading || !stat ? "—" : formatTotal(stat.total)}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {unit}
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
