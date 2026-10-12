"use client";

import { useMemo } from "react";
import { fetchPaidTransactions } from "@/services/metrics/recentTransactions";
import { getWindowBounds } from "@/services/metrics/subgraphMetrics";
import { TransactionsPanel } from "./TransactionsPanel";

export function InvoicesPaidPanel() {
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
