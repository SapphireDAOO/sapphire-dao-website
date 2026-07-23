"use client";

import { fetchPaidTransactions } from "@/services/metrics/recentTransactions";
import { TransactionsPanel } from "./TransactionsPanel";

/** Inline panel for the Total Volume card: payments over the last 30 days. */
export function PaidTransactionsPanel() {
  return (
    <TransactionsPanel
      title="Payments — last 30 days"
      cacheKey="paid-transactions"
      emptyLabel="No payments in the last 30 days."
      fetchPage={fetchPaidTransactions}
      showType={false}
    />
  );
}
