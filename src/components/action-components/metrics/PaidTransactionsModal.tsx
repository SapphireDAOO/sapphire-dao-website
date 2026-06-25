"use client";

import { type ReactNode } from "react";
import { fetchPaidTransactions } from "@/services/metrics/recentTransactions";
import { TransactionsModal } from "./TransactionsModal";

/** `children` is the clickable trigger (e.g. the Total Volume card). */
export function PaidTransactionsModal({ children }: { children: ReactNode }) {
  return (
    <TransactionsModal
      title="Payments — last 30 days"
      cacheKey="paid-transactions"
      emptyLabel="No payments in the last 30 days."
      fetchPage={fetchPaidTransactions}
      showType={false}
    >
      {children}
    </TransactionsModal>
  );
}
