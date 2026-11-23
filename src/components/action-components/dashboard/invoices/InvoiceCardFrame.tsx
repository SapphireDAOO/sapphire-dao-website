"use client";

import { ArrowUpRight, ChevronDown, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { formatAddress } from "@/lib/formatUtils";
import { InfoTip } from "@/components/ui/info-tip";
import { timeLeft } from "@/lib/timeUtils";
import { useSharedSecondTicker } from "@/hooks/useSharedSecondTicker";
import { TONE_PILL, type StatusTone } from "../statusGroups";

const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

export const StatusPill = ({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider",
      TONE_PILL[tone],
    )}
  >
    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
    {label}
  </span>
);

export const InvoiceCardFrame = ({
  displayId,
  idTitle,
  status,
  date,
  amount,
  unit,
  secondary,
  expanded,
  onToggle,
  strip,
  actions,
  children,
}: {
  displayId: string;
  idTitle?: string;
  status: { label: string; tone: StatusTone };
  date?: string | null;
  amount: string;
  unit: string;
  secondary?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  strip?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <article
    className={cn(
      "flex flex-col border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md",
      expanded ? "border-primary/25" : "border-border",
    )}
  >
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex items-start justify-between gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:p-5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono text-xs text-muted-foreground"
            title={idTitle}
          >
            #{displayId}
          </span>
          <StatusPill {...status} />
        </div>
        {date && (
          <p className="mt-2 text-xs text-muted-foreground">{date}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-baseline gap-1 font-mono text-lg font-semibold tabular-nums">
          {amount}
          <span className="text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        </div>
        {secondary && (
          <span className="text-xs text-muted-foreground">{secondary}</span>
        )}
        <ChevronDown
          className={cn(
            "mt-1 size-4 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </div>
    </button>

    {strip && <div className="px-4 pb-4 sm:px-5 sm:pb-5">{strip}</div>}

    {actions && (
      <div className="flex flex-wrap items-start justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
        {actions}
      </div>
    )}

    {expanded && (
      <div className="space-y-4 border-t border-border px-4 py-4 text-sm sm:px-5">
        {children}
      </div>
    )}
  </article>
);

export const Countdown = ({
  startAt,
  endAtMs,
}: {
  startAt: number | string | null;
  endAtMs?: number;
}) => {
  useSharedSecondTicker(true);
  return <>{timeLeft(startAt, 0, endAtMs)}</>;
};

const STRIP_TONE: Record<"warning" | "muted", string> = {
  warning: "border-warning/30 bg-warning/10 text-warning-foreground",
  muted: "border-border bg-muted text-muted-foreground",
};

export const CountdownStrip = ({
  label,
  hint,
  tone = "warning",
  children,
}: {
  label: string;
  hint?: string;
  tone?: "warning" | "muted";
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3 rounded-full border px-3.5 py-2 text-xs",
      STRIP_TONE[tone],
    )}
  >
    <span className="flex items-center gap-2">
      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
      {hint && (
        <InfoTip label={`${label} info`} className="text-current">
          {hint}
        </InfoTip>
      )}
    </span>
    <span className="font-mono tabular-nums">{children}</span>
  </div>
);

export const DetailRows = ({ children }: { children: React.ReactNode }) => (
  <dl className="divide-y divide-border">{children}</dl>
);

export const DetailRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right font-mono text-[13px]">{children}</dd>
  </div>
);

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
    {children}
  </span>
);

const linkClass =
  "inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline";

export const AddressLink = ({ address }: { address?: string }) => {
  if (!address) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={`https://sepolia.basescan.org/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
      onClick={stopProp}
      title={address}
    >
      {formatAddress(address)}
      <ArrowUpRight className="size-3" aria-hidden="true" />
    </a>
  );
};

export const TxLink = ({ hash }: { hash: string }) => (
  <a
    href={`https://sepolia.basescan.org/tx/${hash}`}
    target="_blank"
    rel="noopener noreferrer"
    className={linkClass}
    onClick={stopProp}
    title={hash}
  >
    {formatAddress(hash)}
    <ArrowUpRight className="size-3" aria-hidden="true" />
  </a>
);

export const CopyValue = ({
  value,
  label,
  children,
}: {
  value: string;
  label: string;
  children?: React.ReactNode;
}) => (
  <span className="inline-flex items-center gap-1.5" title={value}>
    {children ?? value}
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className="text-muted-foreground transition-colors hover:text-foreground"
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyText(value)) toast.success(`${label} copied`);
        else toast.error(`Couldn't copy the ${label.toLowerCase()}.`);
      }}
    >
      <Copy className="size-3.5" />
    </button>
  </span>
);

export const HistoryList = ({
  entries,
  format,
}: {
  entries: { status: string; time?: string }[];
  format: (time: string) => string;
}) => (
  <ol className="space-y-1.5">
    {entries.map((entry, idx) => (
      <li
        key={`${entry.status}-${idx}`}
        className="flex items-center justify-between gap-4 text-xs"
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "size-1.5 rounded-full",
              idx === entries.length - 1 ? "bg-primary" : "bg-border",
            )}
            aria-hidden="true"
          />
          {entry.status.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
        </span>
        <span className="font-mono text-muted-foreground">
          {entry.time ? format(entry.time) : ""}
        </span>
      </li>
    ))}
  </ol>
);
