"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { formatUsd } from "./formatMetric";

/** Human label for each transaction kind. */
const KIND_LABEL: Record<TransactionKind, string> = {
  paid: "Payment",
  released: "Release",
  refunded: "Refund",
  settled: "Settlement",
};

const PAGE_SIZE = 10;
const WINDOW_DAYS = 30;

const explorerTxUrl = (txHash: string): string =>
  `https://sepolia.basescan.org/tx/${txHash}`;

const formatTime = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export interface TransactionsModalProps {
  /** Clickable trigger (e.g. a metric card). */
  children: ReactNode;
  /** Dialog title. */
  title: string;
  /** Stable React Query cache-key segment, e.g. "paid" | "escrow". */
  cacheKey: string;
  /** Empty-state message. */
  emptyLabel: string;
  /** Fetch one page of rows for the given 30-day cutoff. */
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
  /** Show the Type column (Payment / Release / …). Defaults to true. */
  showType?: boolean;
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
  const columnCount = showType ? 6 : 5;

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  // Fix the cutoff for the lifetime of the modal so paging is stable.
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPage(0);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : (
          <>
            <div className="min-h-[360px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent [&>th]:text-center [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wide">
                    <TableHead>Invoice</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Amount</TableHead>
                    {showType && <TableHead>Type</TableHead>}
                    <TableHead>Time</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {busy ? (
                    Array.from({ length: PAGE_SIZE }).map((_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        <TableCell colSpan={columnCount}>
                          <div className="h-5 w-full animate-pulse rounded bg-muted" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={columnCount}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        {emptyLabel}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((tx) => {
                      const inflow = tx.kind === "paid";
                      const sign = showDirection ? (inflow ? "+" : "−") : "";
                      return (
                        <TableRow key={tx.id} className="text-center">
                          <TableCell className="font-mono font-medium">
                            #{tx.invoiceNonce}
                          </TableCell>
                          <TableCell>{tx.source}</TableCell>
                          <TableCell className="font-mono whitespace-nowrap">
                            <div
                              className={cn(
                                "font-medium",
                                showDirection &&
                                  (inflow
                                    ? "text-emerald-500"
                                    : "text-destructive"),
                              )}
                            >
                              {sign}
                              {tx.amount} {tx.currency}
                            </div>
                            {tx.amountUsd !== undefined && (
                              <div className="text-xs text-muted-foreground">
                                ({formatUsd(tx.amountUsd)})
                              </div>
                            )}
                          </TableCell>
                          {showType && (
                            <TableCell>{KIND_LABEL[tx.kind]}</TableCell>
                          )}
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatTime(tx.timestamp)}
                          </TableCell>
                          <TableCell>
                            <a
                              href={explorerTxUrl(tx.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="View transaction on the block explorer"
                              className="inline-flex text-muted-foreground transition hover:text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-2">
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
