"use client";

import { useMemo } from "react";
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
import type { PauseActionType } from "@/services/pauseState";
import { decodeMultiSigCalldata } from "@/components/action-components/multisig/decodeCalldata";
import { useAdminTransactions } from "@/hooks/useAdminTransactions";
import { usePauseState } from "@/hooks/usePauseState";
import { unixToGMT } from "@/utils";

/** Governance moves slowly; a handful of rows would hide most of a week. */
const FEED_SIZE = 20;

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

const PAUSE_LABEL: Record<PauseActionType, string> = {
  PAUSED: "Paused",
  UNPAUSED: "Unpaused",
  EMERGENCY_PAUSED: "Emergency paused",
  EMERGENCY_PAUSE_APPROVED: "Emergency pause approved",
};

/** A multisig transaction or a pause action, flattened onto one timeline. */
interface FeedRow {
  key: string;
  txHash: string;
  /** What the transaction actually does, not just how far along it is. */
  title: string;
  badge: { label: string; variant: BadgeVariant };
  /** Contract, arguments, nonce — the supporting line under the title. */
  subtitle: string;
  account: string;
  timestamp: number;
  detail: string | null;
}

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
  const { transactions, isLoading, error } = useAdminTransactions(FEED_SIZE);
  const { actions, isLoading: pausesLoading } = usePauseState();

  const rows = useMemo<FeedRow[]>(() => {
    const multisig: FeedRow[] = transactions.map((tx) => {
      // The status alone says nothing about what was governed; the calldata
      // does, so decode it and fall back to the nonce only when the selector
      // is one we do not know.
      const call = decodeMultiSigCalldata(tx.data);
      const args = call?.params.map((p) => `${p.label} ${p.value}`).join(", ");

      return {
        key: `tx-${tx.id}`,
        txHash: tx.id,
        title: call ? call.functionLabel : `Tx #${tx.nonce}`,
        badge: STATUS_META[tx.status],
        subtitle: call
          ? [`Tx #${tx.nonce}`, call.contractLabel, args]
              .filter(Boolean)
              .join(" · ")
          : `Unrecognised call to ${formatAddress(tx.target)}`,
        account: tx.proposer,
        timestamp: tx.timestamp,
        detail: `${tx.approvalCount} approvals`,
      };
    });

    const pauses: FeedRow[] = actions.map((action) => ({
      key: `pause-${action.id}`,
      txHash: action.txHash,
      title: PAUSE_LABEL[action.type] ?? "Pause control",
      badge: STATUS_META.EXECUTED,
      subtitle: "Pause control · PaymentProcessorStorage",
      account: action.account,
      timestamp: Number(action.timestamp),
      // Only an emergency pause carries an expiry, and when it lapses is the
      // whole question while one is running.
      detail: action.expiry
        ? `Lapses ${unixToGMT(Number(action.expiry))} UTC`
        : null,
    }));

    return [...multisig, ...pauses]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, FEED_SIZE);
  }, [transactions, actions]);

  const loading = isLoading || pausesLoading;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Admin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] w-full animate-pulse rounded-lg bg-muted"
            />
          ))
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No admin activity yet.
          </div>
        ) : (
          rows.map((row) => (
            <a
              key={row.key}
              href={explorerTxUrl(row.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start justify-between rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary"
            >
              <div className="min-w-0 space-y-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {row.title}
                  </span>
                  <Badge variant={row.badge.variant} className="text-xs">
                    {row.badge.label}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {row.subtitle}
                </p>
                <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  {formatAddress(row.account)}
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm text-muted-foreground">
                  {timeAgo(row.timestamp)}
                </div>
                {row.detail && (
                  <div className="text-xs text-muted-foreground">
                    {row.detail}
                  </div>
                )}
              </div>
            </a>
          ))
        )}
      </CardContent>
    </Card>
  );
}
