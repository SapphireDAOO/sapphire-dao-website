"use client";

import { useMemo } from "react";
import { fetchEscrowTransactions } from "@/services/metrics/recentTransactions";
import { getWindowBounds } from "@/services/metrics/subgraphMetrics";
import { TransactionsPanel } from "./TransactionsPanel";

/** Inline panel for the Escrow Balance card: movements today & yesterday. */
export function EscrowTransactionsPanel() {
  // Escrow only covers today + yesterday (matching the card's day-over-day %).
  const since = useMemo(() => getWindowBounds().yesterdayMark, []);

  return (
    <TransactionsPanel
      title="Escrow movements — today & yesterday"
      cacheKey="escrow-transactions"
      emptyLabel="No escrow movements today or yesterday."
      fetchPage={fetchEscrowTransactions}
      sinceSeconds={since}
      showDirection
    />
  );
}
