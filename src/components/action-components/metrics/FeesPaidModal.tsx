"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
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
import { ExternalLink } from "lucide-react";
import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import { fetchFeesPaid } from "@/services/metrics/feesPaid";
import { formatUsd } from "./formatMetric";

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

/** `children` is the clickable trigger (e.g. the Fees Paid card). */
export function FeesPaidModal({ children }: { children: ReactNode }) {
  const { chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const since = useMemo(
    () => Math.floor(Date.now() / 1000) - WINDOW_DAYS * 86400,
    [],
  );

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["fees-paid", chainId, since, page],
    queryFn: () => fetchFeesPaid(chainId, page, PAGE_SIZE, since),
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fees paid — last 30 days</DialogTitle>
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
                    <TableHead>Amount</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {busy ? (
                    Array.from({ length: PAGE_SIZE }).map((_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        <TableCell colSpan={3}>
                          <div className="h-5 w-full animate-pulse rounded bg-muted" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={3}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No fees paid in the last 30 days.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((fee) => (
                      <TableRow key={fee.id} className="text-center">
                        <TableCell className="font-mono whitespace-nowrap">
                          <div className="font-medium">
                            {fee.amount} {fee.currency}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ({formatUsd(fee.amountUsd)})
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatTime(fee.timestamp)}
                        </TableCell>
                        <TableCell>
                          <a
                            href={explorerTxUrl(fee.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View transaction on the block explorer"
                            className="inline-flex text-muted-foreground transition hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))
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
