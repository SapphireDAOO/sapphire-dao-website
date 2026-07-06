"use client";

import { useMemo } from "react";
import { fetchPaidTransactions } from "@/services/metrics/recentTransactions";
import { getWindowBounds } from "@/services/metrics/subgraphMetrics";
import { TransactionsPanel } from "./TransactionsPanel";

/** Inline panel for the Invoices Paid card: invoices paid in the last 7 days. */
export function InvoicesPaidPanel() {
  // Last 7 days, matching the card's 7-day count + % window.
  const since = useMemo(() => getWindowBounds().sevenDaysAgo, []);

  return (
    <TransactionsPanel
      title="Invoices paid — last 7 days"
      cacheKey="invoices-paid"
      emptyLabel="No invoices paid in the last 7 days."
      fetchPage={fetchPaidTransactions}
      sinceSeconds={since}
      showType={false}
    />
  );
}
