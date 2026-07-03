"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BASE_SEPOLIA,
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";
import { fetchFeesPaid } from "@/services/metrics/feesPaid";
import { unixToGMT, formatAddress } from "@/utils";
import { formatUsd } from "./formatMetric";

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
          <h3 className="text-sm font-semibold">Fees paid — last 30 days</h3>
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
                      className="h-[84px] w-full animate-pulse rounded-lg bg-muted"
                    />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No fees paid in the last 30 days.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((fee) => (
                    <Card
                      key={fee.id}
                      className="transition-shadow hover:shadow-md"
                    >
                      <CardHeader className="p-2.5 pb-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-mono text-sm font-semibold">
                            {fee.amount} {fee.currency}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            Fee
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1 p-2.5 pt-0 text-xs">
                        <Field label="USD">{formatUsd(fee.amountUsd)}</Field>
                        <Field label="Time">{unixToGMT(fee.timestamp)}</Field>
                        <Field label="Tx">
                          <a
                            href={explorerTxUrl(fee.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-blue-600 underline hover:text-blue-800"
                          >
                            {formatAddress(fee.txHash)}
                          </a>
                        </Field>
                      </CardContent>
                    </Card>
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
