"use client";

import { useMemo } from "react";
import { fetchEscrowTransactions } from "@/services/metrics/recentTransactions";
import { getWindowBounds } from "@/services/metrics/subgraphMetrics";
import { TransactionsPanel } from "./TransactionsPanel";

export function EscrowTransactionsPanel() {
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
