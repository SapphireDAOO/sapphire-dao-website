"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { formatAddress } from "@/lib/formatUtils";
import type { MultisigStatus } from "@/services/metrics/adminTransactions";
import { useAdminTransactions } from "@/hooks/useAdminTransactions";

const explorerTxUrl = (txHash: string): string =>
  `https://sepolia.basescan.org/tx/${txHash}`;

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_META: Record<
  MultisigStatus,
  { label: string; variant: BadgeVariant }
> = {
  EXECUTED: { label: "Executed", variant: "default" },
  APPROVED: { label: "Approved", variant: "secondary" },
  PROPOSED: { label: "Proposed", variant: "outline" },
  CANCELED: { label: "Canceled", variant: "destructive" },
};

const timeAgo = (unixSeconds: number): string => {
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  if (diff < 60) return `${diff}s ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export function AdminActivity() {
  const { transactions, isLoading, error } = useAdminTransactions();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Admin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[52px] w-full animate-pulse rounded-lg bg-muted"
            />
          ))
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No multisig transactions yet.
          </div>
        ) : (
          transactions.map((tx) => {
            const meta = STATUS_META[tx.status];
            return (
              <a
                key={tx.id}
                href={explorerTxUrl(tx.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">Tx #{tx.nonce}</span>
                    <Badge variant={meta.variant} className="text-xs">
                      {meta.label}
                    </Badge>
                  </div>
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    {formatAddress(tx.proposer)}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    {timeAgo(tx.timestamp)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tx.approvalCount} approvals
                  </div>
                </div>
              </a>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
