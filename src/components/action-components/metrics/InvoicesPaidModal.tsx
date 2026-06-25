"use client";

import { useMemo, type ReactNode } from "react";
import { fetchPaidTransactions } from "@/services/metrics/recentTransactions";
import { getWindowBounds } from "@/services/metrics/subgraphMetrics";
import { TransactionsModal } from "./TransactionsModal";

/** `children` is the clickable trigger (e.g. the Invoices Paid card). */
export function InvoicesPaidModal({ children }: { children: ReactNode }) {
  // Last 7 days, matching the card's 7-day count + % window.
  const since = useMemo(() => getWindowBounds().sevenDaysAgo, []);

  return (
    <TransactionsModal
      title="Invoices paid — last 7 days"
      cacheKey="invoices-paid"
      emptyLabel="No invoices paid in the last 7 days."
      fetchPage={fetchPaidTransactions}
      sinceSeconds={since}
      showType={false}
    >
      {children}
    </TransactionsModal>
  );
}
