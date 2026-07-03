"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import type {
  RecentTransaction,
  TransactionKind,
} from "@/services/metrics/types";
import { unixToGMT, formatAddress } from "@/utils";
import { formatUsd } from "./formatMetric";

type BadgeVariant = "default" | "secondary" | "destructive";

/** Label + badge treatment per transaction kind. */
const KIND_META: Record<TransactionKind, { label: string; badge: BadgeVariant }> =
  {
    paid: { label: "Payment", badge: "default" },
    released: { label: "Release", badge: "secondary" },
    refunded: { label: "Refund", badge: "destructive" },
    settled: { label: "Settlement", badge: "secondary" },
  };

const PAGE_SIZE = 12;
const WINDOW_DAYS = 30;

const explorerTxUrl = (txHash: string): string =>
  `https://sepolia.basescan.org/tx/${txHash}`;

/** One labelled field row inside a card. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

export interface TransactionsModalProps {
  /** Clickable trigger (e.g. a metric card). */
  children: ReactNode;
  /** Dropdown panel title. */
  title: string;
  /** Stable React Query cache-key segment, e.g. "paid" | "escrow". */
  cacheKey: string;
  /** Empty-state message. */
  emptyLabel: string;
  /** Fetch one page of rows for the given cutoff. */
  fetchPage: (
    chainId: number,
    page: number,
    pageSize: number,
    sinceSeconds: number,
  ) => Promise<{ rows: RecentTransaction[]; hasNext: boolean }>;
  /**
   * Show escrow-style direction: INVOICE_PAID is an inflow (+, green) and every
   * other event is an outflow (−, red).
   */
  showDirection?: boolean;
  /** Unix-seconds cutoff; defaults to 30 days ago. */
  sinceSeconds?: number;
  /** Show the kind badge (Payment / Release / …). Defaults to true. */
  showType?: boolean;
}

/** One transaction rendered as a dashboard-style card. */
function TransactionCard({
  tx,
  showDirection,
  showType,
}: {
  tx: RecentTransaction;
  showDirection: boolean;
  showType: boolean;
}) {
  const meta = KIND_META[tx.kind];
  const inflow = tx.kind === "paid";
  const sign = showDirection ? (inflow ? "+" : "−") : "";
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="p-2.5 pb-1">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm font-semibold">
            #{tx.invoiceNonce}
          </h3>
          {showType && (
            <Badge variant={meta.badge} className="text-xs">
              {meta.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 p-2.5 pt-0 text-xs">
        <Field label="Amount">
          <span
            className={cn(
              "font-mono font-medium",
              showDirection &&
                (inflow ? "text-emerald-500" : "text-destructive"),
            )}
          >
            {sign}
            {tx.amount} {tx.currency}
          </span>
          {tx.amountUsd !== undefined && (
            <span className="ml-1 text-muted-foreground">
              ({formatUsd(tx.amountUsd)})
            </span>
          )}
        </Field>
        <Field label="Source">{tx.source}</Field>
        <Field label="Time">{unixToGMT(tx.timestamp)}</Field>
        <Field label="Tx">
          <a
            href={explorerTxUrl(tx.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-600 underline hover:text-blue-800"
          >
            {formatAddress(tx.txHash)}
          </a>
        </Field>
      </CardContent>
    </Card>
  );
}

export function TransactionsModal({
  children,
  title,
  cacheKey,
  emptyLabel,
  fetchPage,
  showDirection = false,
  sinceSeconds,
  showType = true,
}: TransactionsModalProps) {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  // Fix the cutoff for the lifetime of the dropdown so paging is stable.
  const defaultSince = useMemo(
    () => Math.floor(Date.now() / 1000) - WINDOW_DAYS * 86400,
    [],
  );
  const since = sinceSeconds ?? defaultSince;

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: [cacheKey, chainId, since, page],
    queryFn: () => fetchPage(chainId, page, PAGE_SIZE, since),
    enabled: open,
    staleTime: DEFAULT_QUERY_STALE_TIME_MS,
    gcTime: DEFAULT_QUERY_GC_TIME_MS,
  });

  const rows = data?.rows ?? [];
  const hasNext = data?.hasNext ?? false;
  const busy = isLoading || isFetching;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPage(0);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(92vw,680px)] p-0"
      >
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>

        {error ? (
          <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="min-h-[320px]">
              {busy ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[96px] w-full animate-pulse rounded-lg bg-muted"
                    />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {emptyLabel}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((tx) => (
                    <TransactionCard
                      key={tx.id}
                      tx={tx}
                      showDirection={showDirection}
                      showType={showType}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                Page {page + 1}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || busy}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext || busy}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
