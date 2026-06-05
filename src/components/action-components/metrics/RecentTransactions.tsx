"use client";

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Scale,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/formatUtils";
import type {
  RecentTransaction,
  TransactionKind,
} from "@/services/metrics/types";
import { useRecentTransactions } from "@/hooks/useRecentTransactions";

const explorerTxUrl = (txHash: string): string =>
  `https://sepolia.basescan.org/tx/${txHash}`;

type BadgeVariant = "default" | "secondary" | "destructive";

const KIND_META: Record<
  TransactionKind,
  { label: string; icon: ReactNode; sign: string; amountClass: string; badge: BadgeVariant }
> = {
  paid: {
    label: "Paid",
    icon: <ArrowDownLeft className="h-4 w-4 text-emerald-500" />,
    sign: "+",
    amountClass: "text-emerald-500",
    badge: "default",
  },
  released: {
    label: "Released",
    icon: <ArrowUpRight className="h-4 w-4 text-primary" />,
    sign: "-",
    amountClass: "",
    badge: "secondary",
  },
  refunded: {
    label: "Refunded",
    icon: <RotateCcw className="h-4 w-4 text-destructive" />,
    sign: "-",
    amountClass: "text-destructive",
    badge: "destructive",
  },
  settled: {
    label: "Settled",
    icon: <Scale className="h-4 w-4 text-muted-foreground" />,
    sign: "",
    amountClass: "",
    badge: "secondary",
  },
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

function TransactionRow({ tx }: { tx: RecentTransaction }) {
  const meta = KIND_META[tx.kind];
  return (
    <a
      href={explorerTxUrl(tx.txHash)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary"
    >
      <div className="flex items-center gap-3">
        {meta.icon}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">#{tx.invoiceNonce}</span>
            <Badge variant={meta.badge} className="text-xs">
              {meta.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{tx.source}</span>
          </div>
          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            {tx.counterparty ? formatAddress(tx.counterparty) : "—"}
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className={cn("font-mono font-medium", meta.amountClass)}>
          {meta.sign}
          {tx.amount} {tx.currency}
        </div>
        <div className="text-xs text-muted-foreground">
          {timeAgo(tx.timestamp)}
        </div>
      </div>
    </a>
  );
}

export function RecentTransactions() {
  const { transactions, isLoading, error } = useRecentTransactions();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-primary" />
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[60px] w-full animate-pulse rounded-lg bg-muted"
            />
          ))
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No recent transactions.
          </div>
        ) : (
          transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
        )}
      </CardContent>
    </Card>
  );
}
