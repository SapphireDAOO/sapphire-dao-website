"use client";

import { useMemo, type ReactNode } from "react";
import { fetchEscrowTransactions } from "@/services/metrics/recentTransactions";
import { getWindowBounds } from "@/services/metrics/subgraphMetrics";
import { TransactionsModal } from "./TransactionsModal";

/** `children` is the clickable trigger (e.g. the Escrow Balance card). */
export function EscrowTransactionsModal({ children }: { children: ReactNode }) {
  // Escrow only covers today + yesterday (matching the card's day-over-day %).
  const since = useMemo(() => getWindowBounds().yesterdayMark, []);

  return (
    <TransactionsModal
      title="Escrow movements — today & yesterday"
      cacheKey="escrow-transactions"
      emptyLabel="No escrow movements today or yesterday."
      fetchPage={fetchEscrowTransactions}
      sinceSeconds={since}
      showDirection
    >
      {children}
    </TransactionsModal>
  );
}
